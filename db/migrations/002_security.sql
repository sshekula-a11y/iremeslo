-- iŘemeslo – oddělení firem (Row Level Security), role a ochrana dokladů.
-- Role ve firmě: owner = majitel, office = správce/kancelář, worker = pracovník v terénu.
-- Pracovník nemá přístup k tabulkám s cenami; vidí jen přiřazené zakázky přes pohledy worker_*.

-- ---------------------------------------------------------------------------
-- Kdo jsem v dané firmě
-- ---------------------------------------------------------------------------

create or replace function app.my_role(p_company uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select m.role from public.memberships m
  where m.company_id = p_company and m.user_id = auth.uid()
$$;

create or replace function app.is_member(p_company uuid) returns boolean
language sql stable as $$ select app.my_role(p_company) is not null $$;

create or replace function app.is_staff(p_company uuid) returns boolean
language sql stable as $$ select coalesce(app.my_role(p_company) in ('owner', 'office'), false) $$;

create or replace function app.is_owner(p_company uuid) returns boolean
language sql stable as $$ select coalesce(app.my_role(p_company) = 'owner', false) $$;

-- Zápis jen pro majitele a kancelář a jen když firma není v režimu „jen pro čtení“.
create or replace function app.can_write(p_company uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_staff(p_company)
     and not coalesce((select c.read_only from public.companies c where c.id = p_company), true)
$$;

-- Je přihlášený uživatel pracovníkem přiřazeným k zakázce (má na ní řádek v sekci Zaměstnanci)?
create or replace function app.is_assigned(p_company uuid, p_job uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.job_labor l
    join public.employees e on e.company_id = l.company_id and e.id = l.employee_id
    where l.company_id = p_company and l.job_id = p_job and e.user_id = auth.uid() and e.active
  )
$$;

create or replace function app.my_employee_id(p_company uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id from public.employees e
  where e.company_id = p_company and e.user_id = auth.uid() and e.active
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Zapnout RLS všude
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'plans', 'companies', 'memberships', 'invitations', 'subscriptions', 'units',
    'clients', 'employees', 'catalog_items', 'jobs', 'job_work_items', 'job_materials',
    'job_labor', 'job_expenses', 'attachments', 'time_entries', 'number_series', 'series_formats',
    'documents', 'advance_deductions', 'payments', 'audit_log', 'support_access_log'
  ] loop
    -- Bez FORCE: vlastník tabulek (migrace, funkce security definer) RLS obchází, uživatelé ne.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

alter table app.platform_admins enable row level security;

-- ---------------------------------------------------------------------------
-- Práva rolí databáze (co RLS potom zúží na řádky)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema app to authenticated;
grant select on public.plans to anon, authenticated;
grant select, insert, update, delete on
  public.memberships, public.invitations, public.units, public.clients, public.employees,
  public.catalog_items, public.jobs, public.job_work_items, public.job_materials, public.job_labor,
  public.job_expenses, public.attachments, public.time_entries, public.series_formats,
  public.documents, public.advance_deductions, public.payments
to authenticated;
grant select, update on public.companies to authenticated;
grant select on public.subscriptions, public.number_series, public.audit_log, public.support_access_log to authenticated;

-- ---------------------------------------------------------------------------
-- Politiky
-- ---------------------------------------------------------------------------

create policy plans_read on public.plans for select using (true);

create policy companies_read on public.companies for select using (app.is_member(id));
create policy companies_update on public.companies for update using (app.is_owner(id)) with check (app.is_owner(id));

create policy memberships_read on public.memberships for select using (app.is_member(company_id));
create policy memberships_owner on public.memberships for all
  using (app.is_owner(company_id)) with check (app.is_owner(company_id));

create policy invitations_owner on public.invitations for all
  using (app.is_owner(company_id)) with check (app.is_owner(company_id));

create policy subscriptions_read on public.subscriptions for select using (app.is_member(company_id));

create policy units_read on public.units for select using (company_id is null or app.is_member(company_id));
create policy units_write on public.units for all
  using (company_id is not null and app.can_write(company_id))
  with check (company_id is not null and app.can_write(company_id));

-- Tabulky, které vidí a mění jen majitel a kancelář (obsahují ceny, náklady nebo osobní údaje klientů).
do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'employees', 'catalog_items', 'jobs', 'job_work_items', 'job_materials',
    'job_labor', 'job_expenses', 'documents', 'advance_deductions', 'payments', 'series_formats'
  ] loop
    execute format('create policy %I on public.%I for select using (app.is_staff(company_id))', t || '_staff_read', t);
    execute format('create policy %I on public.%I for insert with check (app.can_write(company_id))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update using (app.can_write(company_id)) with check (app.can_write(company_id))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete using (app.can_write(company_id))', t || '_staff_delete', t);
  end loop;
end $$;

create policy number_series_read on public.number_series for select using (app.is_staff(company_id));

-- Docházka: kancelář vše, pracovník jen své záznamy a jen na přiřazených zakázkách.
create policy time_staff_read on public.time_entries for select using (app.is_staff(company_id));
create policy time_staff_write on public.time_entries for all
  using (app.can_write(company_id)) with check (app.can_write(company_id));
create policy time_worker_read on public.time_entries for select
  using (employee_id = app.my_employee_id(company_id));
create policy time_worker_insert on public.time_entries for insert
  with check (
    employee_id = app.my_employee_id(company_id)
    and app.is_assigned(company_id, job_id)
    and created_by = auth.uid()
    and not coalesce((select c.read_only from public.companies c where c.id = company_id), true)
  );
create policy time_worker_update on public.time_entries for update
  using (employee_id = app.my_employee_id(company_id) and created_by = auth.uid() and work_date >= current_date - 7)
  with check (employee_id = app.my_employee_id(company_id) and app.is_assigned(company_id, job_id));
create policy time_worker_delete on public.time_entries for delete
  using (employee_id = app.my_employee_id(company_id) and created_by = auth.uid() and work_date >= current_date - 7);

-- Přílohy (fotky před/po, účtenky)
create policy attachments_staff_read on public.attachments for select using (app.is_staff(company_id));
create policy attachments_staff_write on public.attachments for all
  using (app.can_write(company_id)) with check (app.can_write(company_id));
create policy attachments_worker_read on public.attachments for select
  using (job_id is not null and app.is_assigned(company_id, job_id) and kind in ('photo_before', 'photo_after'));
create policy attachments_worker_insert on public.attachments for insert
  with check (job_id is not null and app.is_assigned(company_id, job_id) and kind in ('photo_before', 'photo_after') and created_by = auth.uid());

create policy audit_owner_read on public.audit_log for select using (app.is_owner(company_id));
create policy support_log_owner_read on public.support_access_log for select using (app.is_owner(company_id));

-- ---------------------------------------------------------------------------
-- Pohledy pro pracovníka: bez cen, bez zisku, jen přiřazené zakázky
-- (pohled běží s právy vlastníka, filtr na přihlášeného uživatele je přímo v něm)
-- ---------------------------------------------------------------------------

create view public.worker_jobs as
  select j.id, j.company_id, j.number, j.title, j.status, j.site_address, j.map_url,
         j.date_from, j.date_to, j.time_from, j.time_to, j.note,
         c.name as client_name, c.phone as client_phone
  from public.jobs j
  left join public.clients c on c.company_id = j.company_id and c.id = j.client_id
  where app.is_assigned(j.company_id, j.id);

create view public.worker_job_work as
  select w.id, w.company_id, w.job_id, w.position, w.description, w.qty, w.unit
  from public.job_work_items w
  where app.is_assigned(w.company_id, w.job_id);

create view public.worker_job_materials as
  select m.id, m.company_id, m.job_id, m.position, m.description, m.qty_planned, m.qty_actual, m.unit
  from public.job_materials m
  where app.is_assigned(m.company_id, m.job_id);

grant select on public.worker_jobs, public.worker_job_work, public.worker_job_materials to authenticated;

-- Pracovník zapíše skutečnou spotřebu materiálu, aniž by viděl ceny.
create or replace function public.record_material_usage(p_material uuid, p_qty numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if p_qty is null or p_qty < 0 then raise exception 'množství musí být nezáporné'; end if;
  select m.company_id, m.job_id into r from public.job_materials m where m.id = p_material;
  if not found then raise exception 'materiál nenalezen'; end if;
  if not (app.is_assigned(r.company_id, r.job_id) or app.can_write(r.company_id)) then
    raise exception 'k této zakázce nemáte přístup' using errcode = '42501';
  end if;
  if (select read_only from public.companies where id = r.company_id) then
    raise exception 'účet je v režimu jen pro čtení' using errcode = '42501';
  end if;
  update public.job_materials set qty_actual = p_qty where id = p_material;
end $$;
revoke all on function public.record_material_usage(uuid, numeric) from public;
grant execute on function public.record_material_usage(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Ochrana dokladů: vystavený doklad nejde smazat ani přepsat, jen stornovat dobropisem
-- ---------------------------------------------------------------------------

create or replace function app.protect_documents() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'vystavený doklad % nelze smazat, jen stornovat opravným dokladem', old.number using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status <> 'draft' then
    if new.status = 'draft' then raise exception 'vystavený doklad nelze vrátit do konceptu' using errcode = '42501'; end if;
    if row(new.company_id, new.type, new.number, new.issue_date, new.taxable_date, new.due_date, new.vat_mode,
           new.total_due, new.snapshot, new.client_id, new.job_id, new.related_document_id)
       is distinct from
       row(old.company_id, old.type, old.number, old.issue_date, old.taxable_date, old.due_date, old.vat_mode,
           old.total_due, old.snapshot, old.client_id, old.job_id, old.related_document_id) then
      raise exception 'vystavený doklad % nelze měnit', old.number using errcode = '42501';
    end if;
  elsif new.status <> 'draft' and new.number is distinct from old.number
        and current_setting('app.issuing', true) is distinct from 'on' then
    raise exception 'doklad se vystavuje jen funkcí issue_document' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger documents_protect before update or delete on public.documents
  for each row execute function app.protect_documents();

-- Koncept se nesmí založit rovnou jako vystavený s vlastním číslem.
create or replace function app.documents_insert_guard() returns trigger
language plpgsql as $$
begin
  if (new.status <> 'draft' or new.number is not null) and current_setting('app.issuing', true) is distinct from 'on' then
    raise exception 'nový doklad musí být koncept bez čísla' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger documents_insert_guard before insert on public.documents
  for each row execute function app.documents_insert_guard();

-- Odečet zálohy: jen zaplacená záloha stejného odběratele, na konceptu ostré faktury.
create or replace function app.check_advance_deduction() returns trigger
language plpgsql as $$
declare inv record; adv record;
begin
  select * into inv from public.documents where company_id = new.company_id and id = new.invoice_id;
  select * into adv from public.documents where company_id = new.company_id and id = new.advance_id;
  if inv.type not in ('invoice', 'invoice_non_payer') then raise exception 'zálohu lze odečíst jen na faktuře'; end if;
  if inv.status <> 'draft' then raise exception 'na vystavené faktuře už nelze měnit odečty záloh'; end if;
  if adv.type <> 'advance' then raise exception 'odečíst lze jen zálohovou fakturu'; end if;
  if adv.status <> 'paid' then raise exception 'nezaplacenou zálohu % nelze odečíst', adv.number; end if;
  if adv.client_id is distinct from inv.client_id then raise exception 'záloha patří jinému odběrateli'; end if;
  return new;
end $$;
create trigger advance_deductions_check before insert or update on public.advance_deductions
  for each row execute function app.check_advance_deduction();

-- Ve firmě musí vždy zůstat aspoň jeden majitel.
create or replace function app.keep_one_owner() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare company uuid;
begin
  company := coalesce(old.company_id, new.company_id);
  if tg_op = 'DELETE' and exists (select 1 from public.companies where id = company) is false then
    return old;  -- maže se celá firma
  end if;
  if not exists (select 1 from public.memberships where company_id = company and role = 'owner') then
    raise exception 've firmě musí zůstat aspoň jeden majitel' using errcode = '42501';
  end if;
  return null;
end $$;
create constraint trigger memberships_keep_owner after update or delete on public.memberships
  for each row execute function app.keep_one_owner();

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare rec jsonb; old_rec jsonb; diff jsonb;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
    diff := rec;
  elsif tg_op = 'INSERT' then
    rec := to_jsonb(new);
    diff := rec;
  else
    rec := to_jsonb(new);
    old_rec := to_jsonb(old);
    select coalesce(jsonb_object_agg(k, jsonb_build_array(old_rec -> k, rec -> k)), '{}'::jsonb) into diff
    from jsonb_object_keys(rec) k
    where k not in ('updated_at') and (old_rec -> k) is distinct from (rec -> k);
    if diff = '{}'::jsonb then return new; end if;
  end if;
  if exists (select 1 from public.companies where id = (rec ->> 'company_id')::uuid) then
    insert into public.audit_log (company_id, actor, table_name, row_id, action, diff)
    values ((rec ->> 'company_id')::uuid, auth.uid(), tg_table_name, (rec ->> 'id')::uuid, lower(tg_op), diff);
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['jobs', 'documents', 'payments', 'clients', 'memberships', 'employees'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Pojistky navíc
-- ---------------------------------------------------------------------------

-- Režim „jen pro čtení“ a tarif mění jen provozovatel (servisní účet bez přihlášeného uživatele),
-- majitel si je sám vypnout nemůže.
create or replace function app.protect_company_flags() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and new.read_only is distinct from old.read_only then
    raise exception 'režim jen pro čtení řídí předplatné, ne uživatel' using errcode = '42501';
  end if;
  if auth.uid() is not null and (select read_only from public.companies where id = old.id) then
    raise exception 'účet je v režimu jen pro čtení' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger companies_protect_flags before update on public.companies
  for each row execute function app.protect_company_flags();

-- Odečet zálohy z už vystavené faktury nejde smazat.
create or replace function app.protect_advance_deduction_delete() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.documents d where d.company_id = old.company_id and d.id = old.invoice_id and d.status <> 'draft') then
    raise exception 'odečet zálohy na vystavené faktuře nelze odebrat' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger advance_deductions_protect_delete before delete on public.advance_deductions
  for each row execute function app.protect_advance_deduction_delete();
