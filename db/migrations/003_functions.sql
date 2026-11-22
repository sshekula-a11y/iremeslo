-- iŘemeslo – číslování dokladů, vystavení dokladu, registrace firmy, pozvánky.

-- ---------------------------------------------------------------------------
-- Číselné řady (stejná pravidla jako packages/core/src/numbering.ts)
-- ---------------------------------------------------------------------------

create or replace function app.default_series_format(p_type text) returns text
language sql immutable as $$
  select case p_type
    when 'job' then 'Z-{RRRR}-{NNNN}'
    when 'quote' then 'CN-{RRRR}-{NNN}'
    when 'advance' then 'ZF-{RRRR}-{NNN}'
    when 'ddpp' then 'DD-{RRRR}-{NNN}'
    when 'invoice' then 'FV-{RRRR}-{NNN}'
    when 'invoice_non_payer' then '{RRRR}{NNN}'
    when 'credit_note' then 'DB-{RRRR}-{NNN}'
    when 'contract' then 'SOD-{RRRR}-{NNN}'
    when 'handover' then 'PP-{RRRR}-{NNN}'
  end
$$;

create or replace function app.format_document_number(p_format text, p_year int, p_seq int) returns text
language plpgsql immutable as $$
declare
  n_token text;
  width int;
  result text;
begin
  n_token := substring(p_format from '\{(N+)\}');
  if n_token is null or (length(p_format) - length(replace(p_format, '{N', ''))) / 2 <> 1 then
    raise exception 'formát řady musí obsahovat právě jedno {NNN}';
  end if;
  if position('{RRRR}' in p_format) = 0 and position('{RR}' in p_format) = 0 then
    raise exception 'formát řady musí obsahovat rok {RRRR} nebo {RR}';
  end if;
  width := length(n_token);
  if p_seq < 1 or length(p_seq::text) > width then
    raise exception 'pořadí % se nevejde do % míst', p_seq, width;
  end if;
  result := replace(p_format, '{RRRR}', lpad(p_year::text, 4, '0'));
  result := replace(result, '{RR}', lpad((p_year % 100)::text, 2, '0'));
  result := replace(result, '{' || n_token || '}', lpad(p_seq::text, width, '0'));
  return result;
end $$;

-- Další číslo v řadě. UPDATE zamkne řádek řady, takže dva současně vystavené doklady
-- nedostanou stejné číslo, a když se transakce vrátí, vrátí se i počítadlo (žádné mezery).
create or replace function app.next_number(p_company uuid, p_type text, p_year int) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  fmt text;
  seq int;
begin
  select f.format into fmt from public.series_formats f where f.company_id = p_company and f.doc_type = p_type;
  fmt := coalesce(fmt, app.default_series_format(p_type));
  if fmt is null then raise exception 'neznámý typ dokladu %', p_type; end if;

  insert into public.number_series (company_id, doc_type, year, format, next_seq)
  values (p_company, p_type, p_year, fmt, 1)
  on conflict (company_id, doc_type, year) do nothing;

  update public.number_series s
     set next_seq = s.next_seq + 1
   where s.company_id = p_company and s.doc_type = p_type and s.year = p_year
  returning s.next_seq - 1, s.format into seq, fmt;

  return app.format_document_number(fmt, p_year, seq);
end $$;
revoke all on function app.next_number(uuid, text, int) from public;

-- Číslo zakázky se přidělí samo při založení.
create or replace function app.assign_job_number() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.number is null then
    new.number := app.next_number(new.company_id, 'job', extract(year from current_date)::int);
  end if;
  return new;
end $$;
create trigger jobs_number before insert on public.jobs for each row execute function app.assign_job_number();

-- ---------------------------------------------------------------------------
-- Vystavení dokladu: přidělí číslo, data a zamkne ho proti změnám
-- ---------------------------------------------------------------------------

create or replace function public.issue_document(p_document uuid, p_issue_date date default current_date) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.documents%rowtype;
  terms int;
  num text;
  series text;
begin
  select * into d from public.documents where id = p_document for update;
  if not found then raise exception 'doklad nenalezen'; end if;
  if not app.can_write(d.company_id) then raise exception 'nemáte oprávnění vystavovat doklady' using errcode = '42501'; end if;
  if d.status <> 'draft' then raise exception 'doklad % už je vystavený', d.number; end if;
  if d.snapshot = '{}'::jsonb then raise exception 'doklad nemá uložené položky a údaje (snapshot)'; end if;
  if d.client_id is null and d.type not in ('quote') then raise exception 'doklad nemá odběratele'; end if;

  series := d.type;
  num := app.next_number(d.company_id, series, extract(year from p_issue_date)::int);
  select c.payment_terms_days into terms from public.companies c where c.id = d.company_id;

  perform set_config('app.issuing', 'on', true);
  update public.documents set
    number = num,
    status = 'issued',
    issue_date = p_issue_date,
    taxable_date = case when d.type in ('invoice', 'invoice_non_payer', 'credit_note', 'ddpp')
                        then coalesce(d.taxable_date, p_issue_date) else d.taxable_date end,
    due_date = case when d.type in ('invoice', 'invoice_non_payer', 'advance')
                    then coalesce(d.due_date, p_issue_date + terms) else d.due_date end,
    valid_until = case when d.type = 'quote' then coalesce(d.valid_until, p_issue_date + 30) else d.valid_until end,
    issued_at = now()
  where id = p_document;
  perform set_config('app.issuing', 'off', true);
  return num;
end $$;
revoke all on function public.issue_document(uuid, date) from public;
grant execute on function public.issue_document(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Registrace firmy: kdo ji založí, je majitel; tarif Beta zdarma
-- ---------------------------------------------------------------------------

create or replace function public.register_company(
  p_name text,
  p_ico text default null,
  p_dic text default null,
  p_street text default null,
  p_city text default null,
  p_zip text default null,
  p_vat_payer boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then raise exception 'nejste přihlášený' using errcode = '42501'; end if;
  if (select count(*) from public.memberships where user_id = uid and role = 'owner') >= 5 then
    raise exception 'jeden uživatel může založit nejvýš 5 firem';
  end if;
  insert into public.companies (name, ico, dic, street, city, zip, vat_payer, default_vat_rate)
  values (p_name, nullif(p_ico, ''), nullif(p_dic, ''), p_street, p_city, p_zip, p_vat_payer, case when p_vat_payer then 21 else 0 end)
  returning id into cid;
  insert into public.memberships (company_id, user_id, role) values (cid, uid, 'owner');
  insert into public.subscriptions (company_id, plan_id, status) values (cid, 'beta', 'active');
  return cid;
end $$;
revoke all on function public.register_company(text, text, text, text, text, text, boolean) from public;
grant execute on function public.register_company(text, text, text, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Pozvánky kolegů (počet uživatelů hlídá tarif)
-- ---------------------------------------------------------------------------

create or replace function app.check_user_limit(p_company uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare lim int; used int;
begin
  select p.max_users into lim from public.subscriptions s join public.plans p on p.id = s.plan_id where s.company_id = p_company;
  if lim is null then return; end if;
  select count(*) into used from public.memberships where company_id = p_company;
  if used >= lim then raise exception 'tarif dovoluje nejvýš % uživatelů', lim; end if;
end $$;

-- Vrátí jednorázový kód pozvánky (v databázi je jen jeho otisk).
create or replace function public.create_invitation(p_company uuid, p_email text, p_role text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare token text;
begin
  if not app.is_owner(p_company) then raise exception 'zvát může jen majitel' using errcode = '42501'; end if;
  perform app.check_user_limit(p_company);
  token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (company_id, email, role, token_hash, invited_by)
  values (p_company, lower(trim(p_email)), p_role, encode(extensions.digest(token, 'sha256'), 'hex'), auth.uid());
  return token;
end $$;
revoke all on function public.create_invitation(uuid, text, text) from public;
grant execute on function public.create_invitation(uuid, text, text) to authenticated;

create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv public.invitations%rowtype;
  my_email text;
begin
  if auth.uid() is null then raise exception 'nejste přihlášený' using errcode = '42501'; end if;
  select * into inv from public.invitations
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'pozvánka je neplatná nebo vypršela';
  end if;
  select lower(email) into my_email from auth.users where id = auth.uid();
  if my_email is distinct from inv.email then raise exception 'pozvánka je pro jiný e-mail'; end if;
  perform app.check_user_limit(inv.company_id);
  insert into public.memberships (company_id, user_id, role) values (inv.company_id, auth.uid(), inv.role)
  on conflict (company_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = inv.id;
  return inv.company_id;
end $$;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Provozovatel: přístup k datům firmy jen se záznamem (podpora pracuje přes servisní účet)
-- ---------------------------------------------------------------------------

create or replace function public.admin_log_support_access(p_company uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from app.platform_admins where user_id = auth.uid()) then
    raise exception 'jen pro provozovatele' using errcode = '42501';
  end if;
  insert into public.support_access_log (admin_user_id, company_id, reason) values (auth.uid(), p_company, p_reason);
end $$;
revoke all on function public.admin_log_support_access(uuid, text) from public;
grant execute on function public.admin_log_support_access(uuid, text) to authenticated;

-- Helpery nejsou určené k přímému volání z aplikace
revoke all on all functions in schema app from public;
grant execute on function app.my_role(uuid), app.is_member(uuid), app.is_staff(uuid), app.is_owner(uuid),
  app.can_write(uuid), app.is_assigned(uuid, uuid), app.my_employee_id(uuid) to authenticated;

-- Limit uživatelů podle tarifu platí i pro přímé přidání člena.
create or replace function app.memberships_limit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.check_user_limit(new.company_id);
  return new;
end $$;
create trigger memberships_limit before insert on public.memberships
  for each row execute function app.memberships_limit();
