-- Automatický test oddělení firem a ochrany dokladů.
-- Akceptační kritérium MVP: „Uživatel firmy A nevidí žádná data firmy B ani přes přímou URL nebo API.“
-- Spouští se přes scripts/test-db.sh na čisté databázi.

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
set client_min_messages = warning;

-- ---------- pomocníci ----------
create function public.t_login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
$$;
create function public.t_eq(actual bigint, expected bigint, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'TEST SELHAL: % (čekal jsem %, je %)', label, expected, actual;
  end if;
  raise notice 'ok – %', label;
end $$;
create function public.t_text(actual text, expected text, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'TEST SELHAL: % (čekal jsem %, je %)', label, expected, actual;
  end if;
  raise notice 'ok – %', label;
end $$;
create function public.t_fails(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok – % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'TEST SELHAL: % – příkaz měl skončit chybou: %', label, stmt;
end $$;
-- počet řádků, které UPDATE/DELETE zasáhl
create function public.t_affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on all functions in schema public to authenticated, anon;

set client_min_messages = notice;

-- ---------- uživatelé ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'majitel-a@test.cz'),
  ('00000000-0000-0000-0000-00000000000b', 'majitel-b@test.cz'),
  ('00000000-0000-0000-0000-0000000000a1', 'kancelar-a@test.cz'),
  ('00000000-0000-0000-0000-0000000000a2', 'pracovnik-a@test.cz'),
  ('00000000-0000-0000-0000-0000000000ff', 'cizi@test.cz');

set role authenticated;

-- ---------- firma A ----------
select t_login('00000000-0000-0000-0000-00000000000a');
select register_company('Firma A s.r.o.', '25020137', 'CZ25020137', 'Hybernská 1', 'Praha', '11000', true) as company_a \gset

insert into clients (company_id, kind, name, email) values (:'company_a', 'person', 'Jan Novák', 'jan@novak.cz') returning id as client_a \gset
insert into employees (company_id, name, rate_day, user_id) values (:'company_a', 'Petr Pracovník', 2500, '00000000-0000-0000-0000-0000000000a2') returning id as emp_a \gset
insert into memberships (company_id, user_id, role) values
  (:'company_a', '00000000-0000-0000-0000-0000000000a1', 'office'),
  (:'company_a', '00000000-0000-0000-0000-0000000000a2', 'worker');

insert into jobs (company_id, title, client_id, date_from, date_to, vat_rate) values
  (:'company_a', 'Střecha Novák', :'client_a', '2026-12-01', '2026-12-03', 12) returning id as job_a, number as job_a_no \gset
insert into jobs (company_id, title, client_id) values (:'company_a', 'Fasáda bez pracovníka', :'client_a') returning id as job_a2 \gset
select t_text(:'job_a_no', 'Z-' || extract(year from current_date) || '-0001', 'zakázka dostala číslo automaticky');

insert into job_work_items (company_id, job_id, description, qty, unit, unit_price) values (:'company_a', :'job_a', 'Čištění + nátěr', 180, 'm²', 250);
insert into job_materials (company_id, job_id, description, qty_planned, unit, purchase_price, sale_price) values
  (:'company_a', :'job_a', 'Barva', 60, 'l', 160, 220) returning id as mat_a \gset
insert into job_labor (company_id, job_id, employee_id, qty_planned, unit, rate) values (:'company_a', :'job_a', :'emp_a', 3, 'den', 2500);

select t_fails(format($q$insert into jobs (company_id, title, date_from, date_to) values (%L, 'x', '2026-12-05', '2026-12-01')$q$, :'company_a'),
  'termín „do“ nesmí být před „od“');

-- ---------- firma B ----------
select t_login('00000000-0000-0000-0000-00000000000b');
select register_company('Firma B', null, null, null, null, null, false) as company_b \gset
insert into clients (company_id, kind, name) values (:'company_b', 'company', 'Klient B') returning id as client_b \gset
insert into jobs (company_id, title, client_id) values (:'company_b', 'Zakázka B', :'client_b') returning id as job_b \gset

-- ---------- B nevidí nic z A ----------
select t_eq((select count(*) from companies where id = :'company_a'), 0, 'B nevidí firmu A');
select t_eq((select count(*) from jobs where company_id = :'company_a'), 0, 'B nevidí zakázky A');
select t_eq((select count(*) from jobs where id = :'job_a'), 0, 'B nevidí zakázku A ani podle ID (přímá URL)');
select t_eq((select count(*) from clients where company_id = :'company_a'), 0, 'B nevidí klienty A');
select t_eq((select count(*) from employees), 0, 'B nevidí zaměstnance A');
select t_eq((select count(*) from job_work_items), 0, 'B nevidí položky prací A');
select t_eq((select count(*) from job_materials), 0, 'B nevidí materiály A');
select t_eq((select count(*) from memberships where company_id = :'company_a'), 0, 'B nevidí uživatele A');
select t_eq((select count(*) from worker_jobs()), 0, 'B nevidí zakázky A ani přes pohled pracovníka');
select t_eq((select count(*) from jobs), 1, 'B vidí jen svou jednu zakázku');

select t_eq(t_affected(format('update jobs set title = %L where id = %L', 'hack', :'job_a')), 0, 'B nemůže přepsat zakázku A');
select t_eq(t_affected(format('delete from clients where id = %L', :'client_a')), 0, 'B nemůže smazat klienta A');
select t_fails(format($q$insert into jobs (company_id, title) values (%L, 'podvrh')$q$, :'company_a'), 'B nemůže založit zakázku do firmy A');
select t_fails(format($q$insert into job_work_items (company_id, job_id, description, qty, unit, unit_price) values (%L, %L, 'x', 1, 'ks', 1)$q$, :'company_b', :'job_a'),
  'B nemůže přivěsit položku ke své firmě, ale k zakázce A');
select t_fails(format($q$insert into memberships (company_id, user_id, role) values (%L, %L, 'owner')$q$, :'company_a', '00000000-0000-0000-0000-00000000000b'),
  'B se nemůže sám přidat do firmy A');
select t_fails(format($q$select record_material_usage(%L, 1)$q$, :'mat_a'), 'B nemůže zapsat spotřebu materiálu A');
select t_eq(t_affected(format('update companies set name = %L where id = %L', 'hack', :'company_a')), 0, 'B nemůže přejmenovat firmu A');

select t_fails(format($q$select save_job(%L, '{"title":"podvrh","vat_mode":"standard","vat_rate":21}'::jsonb)$q$, :'company_a'), 'B nemůže přes save_job zapsat do firmy A');
select t_fails(format($q$select save_job(%L, jsonb_build_object('id', %L, 'title', 'x', 'vat_mode', 'standard', 'vat_rate', 21))$q$, :'company_b', :'job_a'),
  'B nemůže přes save_job přepsat zakázku A ani se svou firmou');

-- ---------- cizí uživatel bez firmy a nepřihlášený ----------
select t_login('00000000-0000-0000-0000-0000000000ff');
select t_eq((select count(*) from jobs), 0, 'cizí uživatel nevidí žádné zakázky');
select t_eq((select count(*) from companies), 0, 'cizí uživatel nevidí žádné firmy');
select t_login(null);
select t_eq((select count(*) from clients), 0, 'nepřihlášený nevidí nic');
reset role;
set role anon;
select t_fails('select * from jobs', 'anonymní role nemá k tabulkám přístup');
select t_eq((select count(*) from plans where is_public), 1, 'anonymní návštěvník vidí veřejný tarif Beta');
reset role;
set role authenticated;

-- ---------- pracovník A: jen přiřazené zakázky, bez cen ----------
select t_login('00000000-0000-0000-0000-0000000000a2');
select t_eq((select count(*) from worker_jobs()), 1, 'pracovník vidí jen zakázku, na kterou je přiřazený');
select t_eq((select count(*) from worker_job_materials(:'job_a')), 1, 'pracovník vidí materiál své zakázky (bez cen)');
select t_eq((select count(*) from jobs), 0, 'pracovník nemá přístup k tabulce zakázek s cenami');
select t_eq((select count(*) from job_materials), 0, 'pracovník nevidí nákupní a prodejní ceny');
select t_eq((select count(*) from employees), 0, 'pracovník nevidí sazby zaměstnanců');
select t_eq((select count(*) from clients), 0, 'pracovník nevidí adresář klientů');
select record_material_usage(:'mat_a', 55);
select t_eq((select qty_actual::bigint from worker_job_materials(:'job_a') where id = :'mat_a'), 55, 'pracovník zapsal skutečnou spotřebu');
insert into time_entries (company_id, job_id, employee_id, work_date, hours, created_by)
  values (:'company_a', :'job_a', :'emp_a', current_date, 8, '00000000-0000-0000-0000-0000000000a2');
select t_eq((select count(*) from time_entries), 1, 'pracovník zapsal a vidí své hodiny');
select t_fails(format($q$insert into time_entries (company_id, job_id, employee_id, work_date, hours, created_by) values (%L, %L, %L, current_date, 8, %L)$q$,
  :'company_a', :'job_a2', :'emp_a', '00000000-0000-0000-0000-0000000000a2'), 'pracovník nemůže psát hodiny na nepřiřazenou zakázku');
select t_fails(format($q$insert into jobs (company_id, title) values (%L, 'x')$q$, :'company_a'), 'pracovník nemůže zakládat zakázky');

-- ---------- uložení zakázky jedním voláním ----------
select t_login('00000000-0000-0000-0000-00000000000a');
select save_job(:'company_a', jsonb_build_object(
  'title', 'Fasáda Dvořák', 'vat_mode', 'standard', 'vat_rate', 21, 'new_client_name', 'Eva Dvořáková',
  'date_from', '2026-12-10', 'date_to', '2026-12-12', 'discount_kind', 'percent', 'discount_value', '10',
  'work', jsonb_build_array(jsonb_build_object('description', 'Nátěr fasády', 'qty', '120.5', 'unit', 'm²', 'unit_price', '310')),
  'materials', jsonb_build_array(jsonb_build_object('description', 'Barva', 'qty_planned', '40', 'unit', 'l', 'purchase_price', '150', 'sale_price', '210', 'billable', true)),
  'labor', jsonb_build_array(jsonb_build_object('employee_id', :'emp_a', 'qty_planned', '3', 'unit', 'den', 'rate', '2500')),
  'expenses', jsonb_build_array(jsonb_build_object('description', 'Plošina', 'qty_planned', '3', 'unit_price', '3000'))
)) as saved_job \gset
select t_eq((select count(*) from job_work_items where job_id = :'saved_job'), 1, 'save_job uložil práce');
select t_eq((select count(*) from clients where name = 'Eva Dvořáková'), 1, 'save_job založil nového klienta');
select save_job(:'company_a', jsonb_build_object('id', :'saved_job', 'title', 'Fasáda Dvořák – upraveno', 'vat_mode', 'standard', 'vat_rate', 12,
  'work', jsonb_build_array(jsonb_build_object('description', 'A', 'qty', '1', 'unit', 'ks', 'unit_price', '1'), jsonb_build_object('description', 'B', 'qty', '2', 'unit', 'ks', 'unit_price', '2')))) \g /dev/null
select t_eq((select count(*) from job_work_items where job_id = :'saved_job'), 2, 'úprava zakázky nahradila řádky');
select t_eq((select count(*) from job_materials where job_id = :'saved_job'), 0, 'odebrané sekce se smazaly');
select t_text((select title from jobs where id = :'saved_job'), 'Fasáda Dvořák – upraveno', 'hlavička zakázky se přepsala');

-- ---------- doklady: číslování bez mezer, vystavený doklad je zamčený ----------
select t_login('00000000-0000-0000-0000-0000000000a1');  -- kancelář A
select t_fails(format($q$insert into documents (company_id, client_id, type, vat_mode, status, number) values (%L, %L, 'invoice', 'standard', 'issued', 'FV-1')$q$,
  :'company_a', :'client_a'), 'doklad nejde založit rovnou jako vystavený s vlastním číslem');

insert into documents (company_id, job_id, client_id, type, vat_mode, total_due, snapshot)
  values (:'company_a', :'job_a', :'client_a', 'invoice', 'standard', 65184, '{"lines":[]}') returning id as inv1 \gset
insert into documents (company_id, job_id, client_id, type, vat_mode, total_due, snapshot)
  values (:'company_a', :'job_a', :'client_a', 'invoice', 'standard', 1000, '{"lines":[]}') returning id as inv2 \gset
select t_text(issue_document(:'inv1', '2026-11-22'), 'FV-2026-001', 'první faktura FV-2026-001');
select t_text(issue_document(:'inv2', '2026-11-23'), 'FV-2026-002', 'druhá faktura navazuje bez mezery');
select t_text((select due_date::text from documents where id = :'inv1'), '2026-12-06', 'splatnost podle nastavení firmy (14 dní)');
select t_text((select taxable_date::text from documents where id = :'inv1'), '2026-11-22', 'DUZP doplněno');
select t_fails(format('select issue_document(%L)', :'inv1'), 'vystavený doklad nejde vystavit znovu');
select t_fails(format('delete from documents where id = %L', :'inv1'), 'vystavený doklad nejde smazat');
select t_fails(format($q$update documents set total_due = 1 where id = %L$q$, :'inv1'), 'vystavenou fakturu nejde přepsat');
select t_eq(t_affected(format($q$update documents set status = 'paid' where id = %L$q$, :'inv1')), 1, 'vystavenou fakturu jde označit jako zaplacenou');

-- odečet zálohy
insert into documents (company_id, job_id, client_id, type, vat_mode, total_due, snapshot)
  values (:'company_a', :'job_a', :'client_a', 'advance', 'standard', 9000, '{"lines":[]}') returning id as zf \gset
select t_text(issue_document(:'zf', '2026-11-22'), 'ZF-2026-001', 'zálohová faktura má vlastní řadu ZF');
insert into documents (company_id, job_id, client_id, type, vat_mode, snapshot)
  values (:'company_a', :'job_a', :'client_a', 'invoice', 'standard', '{"lines":[]}') returning id as inv3 \gset
select t_fails(format($q$insert into advance_deductions (company_id, invoice_id, advance_id, base, vat, vat_rate) values (%L, %L, %L, 7438.02, 1561.98, 21)$q$,
  :'company_a', :'inv3', :'zf'), 'nezaplacenou zálohu nejde odečíst');
update documents set status = 'paid' where id = :'zf';
insert into advance_deductions (company_id, invoice_id, advance_id, base, vat, vat_rate) values (:'company_a', :'inv3', :'zf', 7438.02, 1561.98, 21);
insert into documents (company_id, job_id, client_id, type, vat_mode, snapshot)
  values (:'company_a', :'job_a', :'client_a', 'invoice', 'standard', '{"lines":[]}') returning id as inv4 \gset
select t_fails(format($q$insert into advance_deductions (company_id, invoice_id, advance_id, base, vat, vat_rate) values (%L, %L, %L, 1, 0, 21)$q$,
  :'company_a', :'inv4', :'zf'), 'jednu zálohu nejde odečíst dvakrát');

-- ---------- role ve firmě ----------
select t_fails(format($q$insert into memberships (company_id, user_id, role) values (%L, %L, 'owner')$q$, :'company_a', '00000000-0000-0000-0000-0000000000ff'),
  'kancelář nemůže přidávat uživatele (jen majitel)');
select t_eq(t_affected(format($q$update companies set name = 'x' where id = %L$q$, :'company_a')), 0, 'kancelář nemůže měnit nastavení firmy');
select t_eq((select count(*) from audit_log), 0, 'audit log vidí jen majitel');

select t_login('00000000-0000-0000-0000-00000000000a');  -- majitel A
select t_fails(format($q$delete from memberships where company_id = %L and role = 'owner'$q$, :'company_a'), 've firmě musí zůstat majitel');
select t_eq(((select count(*) from audit_log where table_name = 'documents') > 0)::int, 1, 'změny dokladů jsou v audit logu');

-- pozvánka
select create_invitation(:'company_a', 'cizi@test.cz', 'office') as token \gset
select t_login('00000000-0000-0000-0000-0000000000ff');
select t_fails(format('select accept_invitation(%L)', 'spatny-kod'), 'neplatný kód pozvánky neprojde');
select t_text(accept_invitation(:'token')::text, :'company_a', 'pozvaný kolega se přidal do firmy A');
select t_eq((select count(*) from jobs), 3, 'pozvaný kolega (kancelář) teď vidí zakázky A');
select t_eq((select count(*) from jobs where company_id = :'company_b'), 0, '…ale pořád ne zakázky B');
select t_fails(format('select accept_invitation(%L)', :'token'), 'pozvánku nejde použít dvakrát');

-- ---------- pojistky ----------
select t_login('00000000-0000-0000-0000-00000000000a');
select t_fails(format($q$update companies set read_only = true where id = %L$q$, :'company_a'), 'majitel si nemůže sám přepnout režim jen pro čtení');
select issue_document(:'inv3', '2026-11-24') \g /dev/null
select t_fails(format($q$delete from advance_deductions where advance_id = %L$q$, :'zf'), 'odečet zálohy na vystavené faktuře nejde odebrat');
select t_fails(format($q$update subscriptions set plan_id = 'bez_limitu' where company_id = %L$q$, :'company_a'), 'tarif si uživatel nemůže změnit sám');
reset role;
update subscriptions set plan_id = 'zakladni' where company_id = :'company_a';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a5', 'paty@test.cz'), ('00000000-0000-0000-0000-0000000000a6', 'sesty@test.cz');
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000a');
insert into memberships (company_id, user_id, role) values (:'company_a', '00000000-0000-0000-0000-0000000000a5', 'worker');
select t_fails(format($q$insert into memberships (company_id, user_id, role) values (%L, %L, 'worker')$q$, :'company_a', '00000000-0000-0000-0000-0000000000a6'),
  'tarif Základní pustí nejvýš 5 uživatelů');

-- ---------- režim jen pro čtení (neuhrazené předplatné) ----------
reset role;
select t_login(null) \g /dev/null
update companies set read_only = true where id = :'company_a';
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000a');
select t_eq((select count(*) from jobs), 3, 'v režimu jen pro čtení data zůstávají vidět');
select t_fails(format($q$insert into clients (company_id, kind, name) values (%L, 'person', 'x')$q$, :'company_a'), 'v režimu jen pro čtení nejde zapisovat');
select t_eq(t_affected(format($q$update jobs set title = 'x' where id = %L$q$, :'job_a')), 0, 'v režimu jen pro čtení nejde měnit');

reset role;
\echo
\echo 'VŠECHNY DATABÁZOVÉ TESTY PROŠLY'
