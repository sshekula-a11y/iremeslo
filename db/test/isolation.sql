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
select register_company('Firma B', '27074358', null, null, null, null, false) as company_b \gset
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
select t_eq((select count(*) from plans where is_public and id = 'zkusebni'), 1, 'anonymní návštěvník vidí veřejný tarif Zkušební 30 dní');
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
select t_eq((select count(*) from documents), 0, 'pracovník nevidí nabídky ani faktury');
select t_fails(format($q$insert into documents (company_id, job_id, type, vat_mode, snapshot) values (%L, %L, 'quote', 'standard', '{"x":1}')$q$, :'company_a', :'job_a'), 'pracovník nemůže vystavit nabídku');
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

-- cenová nabídka: vlastní řada CN, může být i bez klienta, platnost 30 dní, po vystavení zamčená
insert into documents (company_id, job_id, type, vat_mode, total_due, snapshot)
  values (:'company_a', :'job_a', 'quote', 'standard', 65184, '{"kind":"quote","lines":[{"description":"Nátěr"}]}') returning id as cn1 \gset
select t_text(issue_document(:'cn1', '2026-11-22'), 'CN-2026-001', 'cenová nabídka má vlastní řadu CN');
select t_text((select valid_until::text from documents where id = :'cn1'), '2026-12-22', 'nabídka platí 30 dní');
select t_fails(format($q$update documents set snapshot = '{}' where id = %L$q$, :'cn1'), 'vystavenou nabídku nejde přepsat');
select t_fails(format('delete from documents where id = %L', :'cn1'), 'vystavenou nabídku nejde smazat');
insert into documents (company_id, type, vat_mode, snapshot) values (:'company_a', 'quote', 'standard', '{}') returning id as cn_empty \gset
select t_fails(format('select issue_document(%L)', :'cn_empty'), 'nabídku bez obsahu nejde vystavit');
select t_eq(t_affected(format('delete from documents where id = %L', :'cn_empty')), 1, 'koncept nabídky jde smazat');

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

-- platba a daňový doklad k přijaté platbě (postup aplikace: platba → stav zaplaceno → DDPP k záloze)
select t_eq(t_affected(format($q$insert into payments (company_id, document_id, paid_on, amount, method) values (%L, %L, '2026-11-20', 9000, 'bank')$q$,
  :'company_a', :'zf')), 1, 'kancelář zapíše platbu zálohy');
select t_fails(format($q$insert into documents (company_id, job_id, client_id, type, vat_mode, snapshot) values (%L, %L, %L, 'ddpp', 'standard', '{"kind":"ddpp"}')$q$,
  :'company_a', :'job_a', :'client_a'), 'DDPP bez vazby na zálohu nejde založit');
insert into documents (company_id, job_id, client_id, type, vat_mode, total_due, taxable_date, related_document_id, snapshot)
  values (:'company_a', :'job_a', :'client_a', 'ddpp', 'standard', 9000, '2026-11-20', :'zf', '{"kind":"ddpp"}') returning id as dd1 \gset
select t_text(issue_document(:'dd1', '2026-11-22'), 'DD-2026-001', 'DDPP má vlastní řadu DD');
select t_text((select taxable_date::text from documents where id = :'dd1'), '2026-11-20', 'DUZP na DDPP je den přijetí platby');
select t_eq((select count(*)::int from documents where id = :'dd1' and due_date is null), 1, 'DDPP nemá splatnost');
insert into documents (company_id, job_id, client_id, type, vat_mode, total_due, taxable_date, snapshot)
  values (:'company_a', :'job_a', :'client_a', 'invoice_non_payer', 'non_payer', 1000, '2026-11-21', '{"kind":"invoice"}') returning id as np1 \gset
select t_text(issue_document(:'np1', '2026-11-22'), '2026001', 'faktura neplátce má řadu 2026001');
select t_text((select taxable_date::text from documents where id = :'np1'), '2026-11-21', 'zvolené DUZP zůstane');

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
select t_eq(t_affected(format($q$update companies set invoice_theme = 'zelena', iban = 'CZ6508000000192000145399', payment_terms_days = 21 where id = %L$q$, :'company_a')), 1, 'majitel mění nastavení firmy (barva, účet, splatnost)');
select t_fails(format($q$update companies set invoice_theme = 'ruzova' where id = %L$q$, :'company_a'), 'neznámou barvu dokladů databáze nepřijme');
update companies set payment_terms_days = 14 where id = :'company_a';
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

-- ---------- administrace provozovatele (/ssh) ----------
reset role;
select t_login(null) \g /dev/null
insert into auth.users (id, email, last_sign_in_at) values ('00000000-0000-0000-0000-0000000000ad', 'provozovatel@test.cz', now());
insert into app.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');
insert into auth.sessions (user_id) values ('00000000-0000-0000-0000-00000000000b');
set role authenticated;

select t_login('00000000-0000-0000-0000-00000000000a');
select t_eq((select admin_whoami()::int), 0, 'majitel firmy není provozovatel');
select t_fails('select admin_overview()', 'majitel firmy nevidí analytiku provozovatele');
select t_fails('select * from admin_users()', 'majitel firmy nevidí seznam uživatelů');
select t_fails(format($q$select admin_record_payment(%L, 199, current_date, 'zakladni', 'month', 'x')$q$, :'company_a'), 'majitel si nemůže sám zapsat platbu');
select t_fails('select * from app.admin_actions', 'záznam zásahů není přímo čitelný');
select t_fails('select * from app.billing_payments', 'platby předplatného nejsou přímo čitelné');

select t_login('00000000-0000-0000-0000-0000000000ad');
select t_eq((select admin_whoami()::int), 1, 'provozovatel je poznaný');
select t_eq((select (admin_overview() ->> 'companies')::int), 2, 'analytika: počet firem');
select t_eq((select jsonb_array_length(admin_overview() -> 'weekly')), 12, 'analytika: registrace za 12 týdnů');
select t_eq((select count(*)::int from admin_companies('')), 2, 'seznam firem');
select t_eq((select count(*)::int from admin_companies('majitel-b')), 1, 'hledání firmy podle e-mailu majitele');
select t_eq((select jsonb_array_length(admin_company(:'company_a') -> 'members')), 5, 'detail firmy: členové');
select t_eq((select count(*)::int from jobs), 0, 'provozovatel nevidí zakázky firem přímo');

select admin_set_read_only(:'company_a', false, 'zaplaceno převodem') \g /dev/null
select t_eq((select count(*)::int from admin_companies('') where id = :'company_a' and not read_only), 1, 'provozovatel vypne režim jen pro čtení');
select t_fails(format($q$select admin_set_read_only(%L, true, '')$q$, :'company_a'), 'zásah bez důvodu nejde');

select t_text((select admin_record_payment(:'company_b', 199, current_date, 'zakladni', 'month', 'faktura 1')::text),
  (current_date + 30 + interval '1 month')::date::text, 'platba během zkušebního období navazuje na jeho konec');
select t_text((select admin_record_payment(:'company_b', 199, current_date, 'zakladni', 'month', 'faktura 2')::text),
  (current_date + 30 + interval '2 months')::date::text, 'další platba navazuje na konec období');
select t_text((select admin_billing() ->> 'mrr'), '199.00', 'měsíční příjem jen z placeného předplatného (A je ve zkušebním období)');
select t_fails(format($q$select admin_record_payment(%L, 100, current_date, 'beta', 'month', 'x')$q$, :'company_b'), 'beta se neplatí');

select t_fails(format($q$select admin_set_user_banned('00000000-0000-0000-0000-0000000000ad', true, 'test')$q$), 'provozovatel nezablokuje sám sebe');
select admin_set_user_banned('00000000-0000-0000-0000-00000000000b', true, 'zneužití') \g /dev/null
select t_eq((select count(*)::int from admin_users('majitel-b') where banned), 1, 'uživatel je zablokovaný');
select admin_set_user_banned('00000000-0000-0000-0000-00000000000b', false, 'omyl') \g /dev/null
select t_eq((select count(*)::int from admin_users('majitel-b') where banned), 0, 'uživatel je odblokovaný');
select t_eq((select count(*)::int from admin_actions_recent(50)), 5, 'každý zásah je v záznamu (režim, 2 platby, blokace, odblokování)');

reset role;
select t_eq((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000b'), 0, 'zablokování ukončí přihlášení');
-- ---------- zkušební období 30 dní jednou na IČO ----------
set role authenticated;
select t_login('00000000-0000-0000-0000-0000000000ff');
select t_fails($q$select register_company('Bez IČO', null)$q$, 'firmu bez IČO založit nejde');
select t_fails($q$select register_company('Krátké IČO', '123')$q$, 'IČO musí mít 8 číslic');
select t_eq((select (trial_for_ico('12345679') ->> 'used')::boolean::int), 0, 'nové IČO má zkušební období volné');
select register_company('Nová firma', '12345679') as trial1 \gset
select t_text((select my_subscription(:'trial1') ->> 'period_end'), (current_date + 30)::text, 'nová firma má 30 dní zdarma');
select t_eq((select (trial_for_ico('12345679') ->> 'used')::boolean::int), 1, 'po založení je období pro IČO čerpané');
select t_eq(t_affected(format($q$insert into clients (company_id, kind, name) values (%L, 'person', 'Zkušební klient')$q$, :'trial1')), 1, 've zkušebním období jde zapisovat');

-- stejné IČO znovu (jiný účet nebo e-mail): dostane jen zbytek původního období
select t_login('00000000-0000-0000-0000-00000000000b');
select register_company('Stejná firma jiný e-mail', '12345679') as trial2 \gset
select t_text((select my_subscription(:'trial2') ->> 'period_end'), (current_date + 30)::text, 'druhá registrace IČO nedostane nových 30 dní');

-- po vyčerpání: nová registrace stejného IČO už zdarma nic nedostane a nejde zapisovat
reset role;
update app.trial_claims set trial_end = current_date - 5, claimed_at = now() - interval '35 days' where ico = '12345679';
set role authenticated;
select t_login('00000000-0000-0000-0000-0000000000a1');
select register_company('Potřetí stejné IČO', '12345679') as trial3 \gset
select t_eq((select (my_subscription(:'trial3') ->> 'ok')::boolean::int), 0, 'vyčerpané IČO: bez zkušebního období');
select t_eq((select (trial_for_ico('12345679') ->> 'active')::boolean::int), 0, 'formulář pozná, že období je vyčerpané');
select t_fails(format($q$insert into clients (company_id, kind, name) values (%L, 'person', 'x')$q$, :'trial3'), 'po vyčerpání zkušebního období nejde zapisovat');
select t_eq((select count(*)::int from companies where id = :'trial3'), 1, 'data firmy zůstávají vidět');
reset role;
select t_eq((select count(*)::int from app.trial_claims where ico = '12345679'), 1, 'jedno IČO = jeden záznam zkušebního období');

-- ---------- registrace bez potvrzovacího e-mailu ----------
set role anon;
select t_login(null) \g /dev/null
select signup_with_password('  Novy.Remeslnik@Example.CZ ', 'tajneheslo123') as new_user \gset
reset role;
select t_text((select email from auth.users where id = :'new_user'), 'novy.remeslnik@example.cz', 'registrace: e-mail uložený malými písmeny');
select t_eq((select count(*)::int from auth.users where id = :'new_user' and email_confirmed_at is not null), 1, 'registrace: účet je rovnou aktivní');
select t_eq((select count(*)::int from auth.users where id = :'new_user' and encrypted_password = extensions.crypt('tajneheslo123', encrypted_password)), 1, 'registrace: heslo je zašifrované a ověřitelné');
select t_eq((select count(*)::int from auth.users where id = :'new_user' and encrypted_password like '$2a$%'), 1, 'registrace: heslo ve formátu bcrypt jako Supabase');
select t_eq((select count(*)::int from auth.identities where user_id = :'new_user' and provider = 'email' and provider_id = :'new_user'), 1, 'registrace: založená identita e-mail');
select t_eq((select count(*)::int from auth.users where id = :'new_user' and confirmation_token = '' and recovery_token = ''), 1, 'registrace: tokeny jsou prázdné, ne NULL');
set role anon;
select t_fails($q$select signup_with_password('novy.remeslnik@example.cz', 'jineheslo99')$q$, 'stejný e-mail nejde registrovat dvakrát');
select t_fails($q$select signup_with_password('NOVY.remeslnik@example.cz', 'jineheslo99')$q$, 'ani s jinými velkými písmeny');
select t_fails($q$select signup_with_password('neplatny-email', 'tajneheslo123')$q$, 'neplatný e-mail neprojde');
select t_fails($q$select signup_with_password('kratke@example.cz', 'kratke')$q$, 'krátké heslo neprojde');
select t_fails('select * from auth.users', 'anonym nevidí uživatele');
reset role;

\echo
\echo 'VŠECHNY DATABÁZOVÉ TESTY PROŠLY'
