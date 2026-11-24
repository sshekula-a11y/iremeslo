-- iŘemeslo – ověření IČO firem v ARES (rozhodnutí: kontakty z poptávek jen pro firmy s ověřeným IČO).
--
-- Ověření dělá databáze sama, aby ho nešlo obejít přímým voláním API:
--  * po založení firmy nebo změně IČO se přes pg_net pošle dotaz do ARES (app.ares_checks),
--  * každou minutu app.process_ares_checks() přečte odpovědi: IČO nalezené v ARES = companies.ico_verified_at,
--    nenalezené = not_found; výpadek ARES = další pokus (nejvýš 5×),
--  * uživatel si příznak nastavit nemůže; při změně IČO se ověření zruší a začne znovu.

alter table public.companies add column if not exists ico_verified_at timestamptz;
alter table public.companies add column if not exists ares_name text;
comment on column public.companies.ico_verified_at is 'Kdy databáze ověřila IČO v ARES. Nastavuje jen app.process_ares_checks().';

create table if not exists app.ares_checks (
  company_id uuid primary key references public.companies(id) on delete cascade,
  ico text not null,
  request_id bigint,
  requested_at timestamptz,
  attempts int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'verified', 'not_found', 'error')),
  checked_at timestamptz,
  detail text
);
create index if not exists ares_checks_pending_idx on app.ares_checks (status) where status = 'pending';
alter table app.ares_checks enable row level security;

/** Pošle dotaz do ARES (asynchronně přes pg_net) a zapíše ho do fronty. */
create or replace function app.ares_request(p_company uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ico text;
  req bigint;
begin
  select ico into v_ico from public.companies where id = p_company;
  if v_ico is null then
    delete from app.ares_checks where company_id = p_company;
    return;
  end if;
  req := net.http_get(
    url := 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/' || v_ico,
    headers := '{"Accept": "application/json"}'::jsonb,
    timeout_milliseconds := 10000);
  insert into app.ares_checks (company_id, ico, request_id, requested_at, attempts, status, checked_at, detail)
  values (p_company, v_ico, req, now(), 1, 'pending', null, null)
  on conflict (company_id) do update set
    ico = excluded.ico, request_id = excluded.request_id, requested_at = now(),
    attempts = case when app.ares_checks.ico = excluded.ico and app.ares_checks.status = 'pending' then app.ares_checks.attempts + 1 else 1 end,
    status = 'pending', checked_at = null, detail = null;
end $$;

/** Uživatel ověření nenastaví; změna IČO ověření zruší. Výjimka jen pro app.process_ares_checks (app.ares = on). */
create or replace function app.guard_ico_verification() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_setting('app.ares', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.ico_verified_at := null;
    new.ares_name := null;
  elsif new.ico is distinct from old.ico then
    new.ico_verified_at := null;
    new.ares_name := null;
  else
    new.ico_verified_at := old.ico_verified_at;
    new.ares_name := old.ares_name;
  end if;
  return new;
end $$;
drop trigger if exists companies_guard_ico on public.companies;
create trigger companies_guard_ico before insert or update on public.companies
  for each row execute function app.guard_ico_verification();

create or replace function app.queue_ares_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.ico is distinct from old.ico then
    perform app.ares_request(new.id);
  end if;
  return null;
end $$;
drop trigger if exists companies_queue_ares on public.companies;
create trigger companies_queue_ares after insert or update of ico on public.companies
  for each row execute function app.queue_ares_check();

/** Zpracuje odpovědi ARES; spouští pg_cron každou minutu. Vrací počet vyřízených. */
create or replace function app.process_ares_checks() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  resp record;
  j jsonb;
  n int := 0;
begin
  for r in select * from app.ares_checks where status = 'pending' order by requested_at limit 200 loop
    select status_code, content into resp from net._http_response where id = r.request_id;
    if not found then
      -- odpověď ještě není (nebo se ztratila): po 10 minutách zkusit znovu, po 5 pokusech vzdát
      if r.requested_at < now() - interval '10 minutes' then
        if r.attempts >= 5 then
          update app.ares_checks set status = 'error', checked_at = now(), detail = 'ARES neodpověděl' where company_id = r.company_id;
        else
          perform app.ares_request(r.company_id);
        end if;
      end if;
      continue;
    end if;

    if resp.status_code = 200 then
      begin
        j := resp.content::jsonb;
      exception when others then
        j := null;
      end;
      if j is not null and j ->> 'ico' = r.ico then
        perform set_config('app.ares', 'on', true);
        update public.companies set ico_verified_at = now(), ares_name = left(j ->> 'obchodniJmeno', 300)
        where id = r.company_id and ico = r.ico;
        perform set_config('app.ares', 'off', true);
        update app.ares_checks set status = 'verified', checked_at = now(), detail = left(j ->> 'obchodniJmeno', 300) where company_id = r.company_id;
      else
        update app.ares_checks set status = 'error', checked_at = now(), detail = 'nečekaná odpověď ARES' where company_id = r.company_id;
      end if;
    elsif resp.status_code in (400, 404) then
      update app.ares_checks set status = 'not_found', checked_at = now(), detail = 'IČO v ARES nenalezeno' where company_id = r.company_id;
    elsif r.attempts >= 5 then
      update app.ares_checks set status = 'error', checked_at = now(), detail = 'ARES vrátil ' || coalesce(resp.status_code::text, '?') where company_id = r.company_id;
    elsif r.requested_at < now() - interval '5 minutes' then
      perform app.ares_request(r.company_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('iremeslo-ares-checks', '* * * * *', 'select app.process_ares_checks()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Kontakty z poptávek jen pro firmy s ověřeným IČO
-- ---------------------------------------------------------------------------

create or replace function app.has_verified_company(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships m join public.companies c on c.id = m.company_id
    where m.user_id = p_user and m.role in ('owner', 'office') and c.ico_verified_at is not null
  )
$$;

create or replace function public.inquiry_contact(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  i app.inquiries%rowtype;
begin
  if uid is null then raise exception 'kontakt vidí jen přihlášení řemeslníci' using errcode = '42501'; end if;
  if not app.email_verified(uid) then raise exception 'nejprve potvrďte svůj e-mail' using errcode = '42501'; end if;
  if not app.has_verified_company(uid) then raise exception 'kontakt vidí jen firmy s IČO ověřeným v ARES' using errcode = '42501'; end if;
  select * into i from app.inquiries where id = p_id and status = 'open' and expires_at >= now();
  if not found then raise exception 'poptávka už není aktivní' using errcode = 'P0002'; end if;
  if not exists (select 1 from app.inquiry_contact_views where inquiry_id = p_id and user_id = uid) then
    if (select count(*) from app.inquiry_contact_views where user_id = uid and viewed_at > now() - interval '1 day') >= 50 then
      raise exception 'dnes jste zobrazili už 50 kontaktů, zkuste to zítra' using errcode = '53400';
    end if;
    insert into app.inquiry_contact_views (inquiry_id, user_id) values (p_id, uid);
  end if;
  return jsonb_build_object('name', i.contact_name, 'phone', i.contact_phone, 'email', i.contact_email,
                            'street', i.street, 'city', i.city, 'zip', i.zip);
end $$;

/** Pro web: co přihlášenému chybí ke kontaktům (potvrzený e-mail, firma, ověření IČO). */
create or replace function public.my_contact_access() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'email_verified', app.email_verified(auth.uid()),
    'has_company', exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role in ('owner', 'office')),
    'verified', app.has_verified_company(auth.uid()),
    'pending', exists (select 1 from public.memberships m join app.ares_checks a on a.company_id = m.company_id
                       where m.user_id = auth.uid() and a.status = 'pending'),
    'not_found', exists (select 1 from public.memberships m join app.ares_checks a on a.company_id = m.company_id
                         where m.user_id = auth.uid() and a.status in ('not_found', 'error'))
  )
  where auth.uid() is not null
$$;

/** Administrace: stav ověření firem a ruční nové ověření. */
create or replace function public.admin_ares_checks() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform app.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object('company_id', a.company_id, 'name', c.name, 'ico', a.ico, 'status', a.status,
           'attempts', a.attempts, 'requested_at', a.requested_at, 'checked_at', a.checked_at, 'detail', a.detail) order by a.requested_at desc), '[]'::jsonb)
  into r from app.ares_checks a join public.companies c on c.id = a.company_id;
  return r;
end $$;

create or replace function public.admin_recheck_ares(p_company uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  perform app.ares_request(p_company);
  perform app.log_admin('ares_recheck', p_company, null, '{}'::jsonb);
end $$;

-- Existující firmy ověřit hned
do $$ declare c record; begin
  for c in select id from public.companies where ico is not null and ico_verified_at is null loop
    perform app.ares_request(c.id);
  end loop;
end $$;

revoke all on function app.ares_request(uuid), app.process_ares_checks(), app.has_verified_company(uuid) from public, anon, authenticated;
revoke all on function public.inquiry_contact(uuid), public.my_contact_access(), public.admin_ares_checks(), public.admin_recheck_ares(uuid)
  from public, anon;
grant execute on function public.inquiry_contact(uuid), public.my_contact_access(), public.admin_ares_checks(), public.admin_recheck_ares(uuid)
  to authenticated;
