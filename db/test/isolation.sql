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
select t_eq((select email_registered(' NOVY.remeslnik@example.cz ')::int), 1, 'existující e-mail: má účet (bez ohledu na velikost písmen)');
select t_eq((select email_registered('nikdo@example.cz')::int), 0, 'neznámý e-mail: nemá účet');
reset role;

-- ---------- potvrzení e-mailu (010) ----------
select t_eq((select count(*)::int from app.unverified_users where user_id = :'new_user'), 1, 'nový účet čeká na potvrzení e-mailu');
select t_eq((select count(*)::int from app.unverified_users where user_id = '00000000-0000-0000-0000-00000000000a'), 0, 'účty založené dřív platí jako potvrzené');
select t_eq((select count(*)::int from app.email_log where to_email = 'novy.remeslnik@example.cz' and error like 'chybí klíč%'), 1, 'bez klíče Resend se e-mail jen zapíše do logu');
select t_eq((select count(*)::int from net._test_requests where url like 'https://api.resend.com%'), 0, 'bez klíče se nic neodeslalo');

insert into vault.secrets (name, secret) values ('resend_api_key', 're_test_1234567890');
set role anon;
select signup_with_password('overit@example.cz', 'tajneheslo123') as ver_user \gset
reset role;
select t_text((select url from net._test_requests order by id desc limit 1), 'https://api.resend.com/emails', 'e-mail jde přes Resend');
select t_text((select headers ->> 'Authorization' from net._test_requests order by id desc limit 1), 'Bearer re_test_1234567890', 'klíč z trezoru v hlavičce');
select t_text((select body -> 'to' ->> 0 from net._test_requests order by id desc limit 1), 'overit@example.cz', 'e-mail jde na registrovanou adresu');
select t_text((select body ->> 'from' from net._test_requests order by id desc limit 1), 'iRemeslo.cz <info@iremeslo.cz>', 'odesílatel info@iremeslo.cz');
select t_eq((select count(*)::int from net._test_requests where body ->> 'html' like '%logo-bez-sloganu.png%' and body ->> 'subject' like 'Potvrďte%'), 1, 'český e-mail s logem');
select substring((select body ->> 'html' from net._test_requests order by id desc limit 1) from 'https://www\.iremeslo\.cz/overeni\?t=([0-9a-f]{64})') as ver_token \gset
select t_eq(length(:'ver_token'), 64, 'odkaz vede na www.iremeslo.cz/overeni s tokenem');
select t_eq((select count(*)::int from app.email_verifications where token_hash = :'ver_token'), 0, 'token se neukládá v čitelné podobě');

set role authenticated;
select t_login(:'ver_user');
select t_eq((select (my_email_status() ->> 'verified')::boolean::int), 0, 'stav: e-mail nepotvrzený');
select t_fails('select resend_verification()', 'znovu poslat jde až za 2 minuty');
reset role;
update app.email_verifications set created_at = now() - interval '3 minutes' where user_id = :'ver_user';
set role authenticated;
select t_text((select resend_verification() ->> 'sent'), 'true', 'po 2 minutách jde e-mail poslat znovu');
select t_fails('select * from app.email_verifications', 'tokeny nejsou přímo čitelné');
select t_fails('delete from app.unverified_users', 'potvrzení nejde obejít smazáním záznamu');

-- nepotvrzený majitel: nabídku vystaví, fakturu ne
select t_login('00000000-0000-0000-0000-00000000000b');
reset role;
insert into app.unverified_users (user_id, email) values ('00000000-0000-0000-0000-00000000000b', 'majitel-b@test.cz');
set role authenticated;
insert into clients (company_id, kind, name) values (:'trial2', 'person', 'Zákazník') returning id as ver_client \gset
insert into documents (company_id, client_id, type, vat_mode, total_due, snapshot)
  values (:'trial2', :'ver_client', 'invoice_non_payer', 'standard', 1000, '{"lines":[]}') returning id as ver_inv \gset
insert into documents (company_id, client_id, type, vat_mode, total_due, snapshot)
  values (:'trial2', :'ver_client', 'quote', 'standard', 1000, '{"kind":"quote","lines":[{"description":"x"}]}') returning id as ver_quote \gset
select t_fails(format('select issue_document(%L)', :'ver_inv'), 'bez potvrzeného e-mailu nejde vystavit fakturu');
select t_text(left(issue_document(:'ver_quote'), 3), 'CN-', 'nabídku jde vystavit i bez potvrzení');

-- odkaz z e-mailu (bez přihlášení)
set role anon;
select t_login(null) \g /dev/null
select t_text((select confirm_email('00' || right(:'ver_token', 62)) ->> 'ok'), 'false', 'cizí token neprojde');
select t_text((select confirm_email('neco') ->> 'reason'), 'invalid', 'nesmyslný token neprojde');
select t_text((select confirm_email(:'ver_token') ->> 'ok'), 'true', 'odkaz z e-mailu potvrdí e-mail');
select t_text((select confirm_email(:'ver_token') ->> 'already'), 'true', 'druhé kliknutí: už potvrzeno');
reset role;
select t_eq((select count(*)::int from app.unverified_users where user_id = :'ver_user'), 0, 'účet je potvrzený');
update app.email_verifications set expires_at = now() - interval '1 minute' where user_id = '00000000-0000-0000-0000-00000000000b';
insert into app.email_verifications (token_hash, user_id, email, expires_at)
  values (encode(extensions.digest(repeat('ab', 32), 'sha256'), 'hex'), '00000000-0000-0000-0000-00000000000b', 'majitel-b@test.cz', now() - interval '1 minute');
set role anon;
select t_text((select confirm_email(repeat('ab', 32)) ->> 'reason'), 'expired', 'prošlý odkaz neplatí');
reset role;
delete from app.unverified_users where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000b');
select t_text(left(issue_document(:'ver_inv'), 4), '2026', 'po potvrzení e-mailu faktura projde');

-- administrace e-mailů
select t_fails('select admin_email_settings()', 'majitel nevidí nastavení e-mailů');
select t_fails($q$select admin_set_email_settings('re_podvrh_1234567890', null, null)$q$, 'majitel nemůže změnit klíč');
select t_login('00000000-0000-0000-0000-0000000000ad');
select t_text((select admin_email_settings() ->> 'key_hint'), '…7890', 'administrace ukáže jen konec klíče');
select t_fails($q$select admin_set_email_settings('spatny', null, null)$q$, 'neplatný klíč neprojde');
select t_fails($q$select admin_set_email_settings(null, 'http://iremeslo.cz', null)$q$, 'adresa webu musí být https');
select t_fails($q$select admin_set_email_settings('re_Usekly_klic', null, null)$q$, 'useknutý klíč Resend neprojde');
select admin_set_email_settings('re_NovyKlic12_abcdefghijklmnopqrstcdef', 'https://iremeslo.cz/', null) \g /dev/null
select t_text((select admin_email_settings() ->> 'key_hint'), '…cdef', 'klíč se v trezoru přepsal');
select t_text((select admin_email_settings() ->> 'site_url'), 'https://iremeslo.cz', 'adresa webu bez lomítka na konci');
select t_text((select admin_send_test_email('test@example.cz')::text), 'true', 'zkušební e-mail odeslán');
select t_eq((select jsonb_array_length(admin_email_settings() -> 'log') >= 3)::int, 1, 'log odeslaných e-mailů');
select admin_verify_user(:'new_user') \g /dev/null
select t_eq((select (admin_email_settings() ->> 'unverified_count')::int), 0, 'provozovatel může e-mail potvrdit ručně');

-- úklid: nepotvrzený účet bez firmy po 7 dnech zmizí, s firmou zůstane
reset role;
insert into app.unverified_users (user_id, email, created_at) values
  (:'ver_user', 'overit@example.cz', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000000b', 'majitel-b@test.cz', now() - interval '8 days');
select t_eq(app.cleanup_unverified(), 1, 'úklid smazal jeden nepotvrzený účet');
select t_eq((select count(*)::int from auth.users where id = :'ver_user'), 0, 'účet bez firmy smazán');
select t_eq((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 1, 'účet s firmou zůstal');
delete from app.unverified_users;

-- ---------- veřejné poptávky (012) ----------
reset role;
delete from net._test_requests;
set role anon;
select t_login(null) \g /dev/null
select (submit_inquiry('{"category":"fasady","title":"Zateplení fasády rodinného domu","quantity":"500","unit":"m2",
  "description":"Zateplení fasády 15 cm EPS včetně omítky, dům je dvoupodlažní.","city":"Brno","zip":"602 00",
  "street":"Lipová 12","term":"quarter","contact_name":"Jana Poptávková","contact_phone":"+420 777 123 456",
  "contact_email":"Jana@Example.cz"}'::jsonb) ->> 'id')::uuid as inq \gset
select t_fails($q$select submit_inquiry('{"category":"fasady","title":"x","description":"krátké","city":"B","term":"asap","contact_name":"J","contact_email":"spatny"}'::jsonb)$q$, 'neúplnou poptávku nejde zadat');
select t_fails($q$select submit_inquiry('{"category":"neexistuje","title":"Zateplení fasády","description":"Popis poptávky dost dlouhý na kontrolu.","city":"Brno","term":"asap","contact_name":"Jan","contact_email":"jan@example.cz"}'::jsonb)$q$, 'neznámá kategorie neprojde');
select t_fails('select * from app.inquiries', 'tabulka poptávek není přímo čitelná');
select t_eq((select count(*)::int from (select get_inquiry(:'inq') as g) x where g is not null), 0, 'nepotvrzená poptávka není veřejná');
select t_eq((select (list_inquiries() ->> 'total')::int), 0, 'nepotvrzená poptávka není v seznamu');
reset role;
select t_text((select body -> 'to' ->> 0 from net._test_requests order by id desc limit 1), 'jana@example.cz', 'potvrzení poptávky jde zadavateli');
select substring((select body ->> 'html' from net._test_requests order by id desc limit 1) from '/poptavky/sprava\?t=([0-9a-f]{64})') as inq_token \gset
select t_eq(length(:'inq_token'), 64, 'e-mail obsahuje odkaz na správu poptávky');
select t_eq((select count(*)::int from net._test_requests where body ->> 'html' like '%„Zateplení fasády rodinného domu“%'), 1, 'název poptávky v e-mailu');
set role anon;
select t_text((select confirm_inquiry('00' || right(:'inq_token', 62)) ->> 'ok'), 'false', 'cizí token poptávku nepotvrdí');
select t_text((select confirm_inquiry(:'inq_token') ->> 'just_confirmed'), 'true', 'odkaz z e-mailu poptávku zveřejní');
select t_text((select confirm_inquiry(:'inq_token') ->> 'just_confirmed'), 'false', 'druhé otevření jen zobrazí správu');
select t_eq((select (list_inquiries() ->> 'total')::int), 1, 'potvrzená poptávka je v seznamu');
select t_eq((select (list_inquiries('fasady', 'brn') ->> 'total')::int), 1, 'filtr kategorie a obce');
select t_eq((select (list_inquiries('strechy') ->> 'total')::int), 0, 'jiná kategorie poptávku nenajde');
select t_eq((select (list_inquiries(null, '602') ->> 'total')::int), 1, 'hledání podle PSČ');
select t_eq((select count(*)::int from (select get_inquiry(:'inq') as g) x where g ? 'contact_email' or g ? 'street' or g::text like '%777%'), 0, 'veřejný detail neobsahuje kontakt ani ulici');
select t_eq((select count(*)::int from (select list_inquiries() as g) x where g::text like '%Poptávková%' or g::text like '%Lipová%'), 0, 'seznam neobsahuje kontakt ani ulici');
select t_fails(format('select inquiry_contact(%L)', :'inq'), 'nepřihlášený kontakt nevidí');
reset role;
insert into app.unverified_users (user_id, email) values (:'new_user', 'x') on conflict do nothing;
set role authenticated;
select t_login(:'new_user');
select t_fails(format('select inquiry_contact(%L)', :'inq'), 'uživatel s nepotvrzeným e-mailem kontakt nevidí');
reset role;
delete from app.unverified_users where user_id = :'new_user';
set role authenticated;
select t_fails(format('select inquiry_contact(%L)', :'inq'), 'uživatel bez firmy s ověřeným IČO kontakt nevidí');
reset role;
select set_config('app.ares', 'on', false) \g /dev/null
update companies set ico_verified_at = now(), ares_name = 'Firma A s.r.o.' where id = :'company_a';
select set_config('app.ares', 'off', false) \g /dev/null
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000a');
select t_text((select inquiry_contact(:'inq') ->> 'phone'), '+420 777 123 456', 'firma s IČO ověřeným v ARES vidí telefon');
select t_text((select inquiry_contact(:'inq') ->> 'street'), 'Lipová 12', '… i ulici');
select t_text((select get_inquiry(:'inq') ->> 'views'), '1', 'zobrazení kontaktu se počítá jednou na uživatele');
select t_login('00000000-0000-0000-0000-00000000000a');
select t_fails(format($q$select admin_set_inquiry_status(%L, 'hidden')$q$, :'inq'), 'běžný uživatel poptávku neskryje');
select t_fails('select admin_inquiries()', 'běžný uživatel nevidí administraci poptávek');
set role anon;
select t_login(null) \g /dev/null
select t_text((select close_inquiry(:'inq_token')::text), 'true', 'zadavatel poptávku uzavře odkazem');
select t_eq((select (list_inquiries() ->> 'total')::int), 0, 'uzavřená poptávka zmizí ze seznamu');
select t_text((select get_inquiry(:'inq') ->> 'status'), 'closed', 'detail uzavřené poptávky ukáže stav');
reset role;
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000a');
select t_fails(format('select inquiry_contact(%L)', :'inq'), 'u uzavřené poptávky se kontakt už nevydá');
select t_login('00000000-0000-0000-0000-0000000000ad');
select admin_set_inquiry_status(:'inq', 'hidden') \g /dev/null
select t_eq((select count(*)::int from (select get_inquiry(:'inq') as g) x where g is not null), 0, 'skrytá poptávka není veřejná');
select t_eq((select jsonb_array_length(admin_inquiries())), 1, 'provozovatel vidí poptávky v administraci');
reset role;
update app.inquiries set closed_at = now() - interval '91 days' where id = :'inq';
select t_eq(app.cleanup_inquiries(), 1, 'úklid smaže poptávku 90 dní po uzavření');

-- ---------- termín realizace poptávky (013) ----------
set role anon;
select t_login(null) \g /dev/null
select (submit_inquiry(jsonb_build_object('category','malovani','title','Výmalba bytu 2+1','description','Výmalba dvou pokojů a kuchyně, bílá barva.',
  'city','Praha','term','date','term_from',(current_date + 10)::text,'term_date',(current_date + 20)::text,
  'contact_name','Petr Test','contact_email','petr@example.cz')) ->> 'id')::uuid as inq2 \gset
select t_fails($q$select submit_inquiry(jsonb_build_object('category','malovani','title','Výmalba bytu 2+1','description','Výmalba dvou pokojů a kuchyně, bílá barva.','city','Praha','term','date','term_from',(current_date + 20)::text,'term_date',(current_date + 10)::text,'contact_name','Petr Test','contact_email','petr@example.cz'))$q$, 'dokončení před zahájením neprojde');
select t_fails($q$select submit_inquiry(jsonb_build_object('category','malovani','title','Výmalba bytu 2+1','description','Výmalba dvou pokojů a kuchyně, bílá barva.','city','Praha','term','date','term_from',(current_date - 1)::text,'contact_name','Petr Test','contact_email','petr@example.cz'))$q$, 'termín v minulosti neprojde');
select t_fails($q$select submit_inquiry(jsonb_build_object('category','malovani','title','Výmalba bytu 2+1','description','Výmalba dvou pokojů a kuchyně, bílá barva.','city','Praha','term','date','contact_name','Petr Test','contact_email','petr@example.cz'))$q$, 'vlastní termín bez data neprojde');
reset role;
select t_text((select term_from::text || '/' || term_date::text from app.inquiries where id = :'inq2'), (current_date + 10)::text || '/' || (current_date + 20)::text, 'vlastní termín od–do se uloží');
update app.inquiries set status = 'open' where id = :'inq2';
set role anon;
select t_text((select get_inquiry(:'inq2') ->> 'term_from'), (current_date + 10)::text, 'veřejný detail ukáže začátek termínu');
reset role;
select (submit_inquiry(jsonb_build_object('category','uklid','title','Úklid po malování','description','Jednorázový úklid bytu po malování, 60 m².',
  'city','Praha','term','asap','term_date',(current_date + 5)::text,'contact_name','Petr Test','contact_email','petr2@example.cz')) ->> 'id')::uuid as inq3 \gset
select t_eq((select count(*)::int from app.inquiries where id = :'inq3' and term = 'asap' and term_from is null and term_date is null), 1, 'u „ihned“ se data neukládají');

-- ---------- ověření IČO v ARES (014) ----------
reset role;
select t_eq((select count(*)::int from app.ares_checks where company_id = :'company_a'), 1, 'založení firmy zařadí ověření v ARES');
select t_eq((select count(*)::int from app.ares_checks where company_id = :'company_b' and ico = '27074358' and request_id is not null), 1, 'dotaz jde do ARES na IČO firmy');
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000b');
update companies set ico_verified_at = now(), ares_name = 'Podvrh' where id = :'company_b';
reset role;
select t_eq((select count(*)::int from companies where id = :'company_b' and ico_verified_at is null and ares_name is null), 1, 'uživatel si ověření sám nenastaví');
-- odpověď ARES: B nalezena, firma trial3 nenalezena
insert into net._http_response (id, status_code, content)
  select request_id, 200, '{"ico":"27074358","obchodniJmeno":"Firma B z ARES"}' from app.ares_checks where company_id = :'company_b';
insert into net._http_response (id, status_code, content)
  select request_id, 404, '{"kod":"NENALEZENO"}' from app.ares_checks where company_id = :'trial3';
select app.process_ares_checks() \g /dev/null
select t_text((select ares_name from companies where id = :'company_b'), 'Firma B z ARES', 'IČO nalezené v ARES = firma ověřená');
select t_eq((select count(*)::int from companies where id = :'company_b' and ico_verified_at is not null), 1, '… s časem ověření');
select t_text((select status from app.ares_checks where company_id = :'trial3'), 'not_found', 'nenalezené IČO se označí');
select t_eq((select count(*)::int from companies where id = :'trial3' and ico_verified_at is null), 1, 'nenalezená firma ověřená není');
-- změna IČO ověření zruší a pošle nový dotaz
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000b');
select t_text((select my_contact_access() ->> 'verified'), 'true', 'majitel B má přístup ke kontaktům');
update companies set ico = '25596641' where id = :'company_b';
reset role;
select t_eq((select count(*)::int from companies where id = :'company_b' and ico_verified_at is null), 1, 'změna IČO zruší ověření');
select t_text((select status || ':' || ico from app.ares_checks where company_id = :'company_b'), 'pending:25596641', 'a zařadí nové ověření');
-- výpadek ARES: opakování
update app.ares_checks set requested_at = now() - interval '11 minutes' where company_id = :'company_b';
delete from net._http_response where id = (select request_id from app.ares_checks where company_id = :'company_b');
select app.process_ares_checks() \g /dev/null
select t_eq((select attempts from app.ares_checks where company_id = :'company_b'), 2, 'bez odpovědi se dotaz po 10 minutách zopakuje');
set role authenticated;
select t_login('00000000-0000-0000-0000-00000000000b');
select t_fails('select admin_ares_checks()', 'stav ověření vidí jen provozovatel');
select t_fails('select * from app.ares_checks', 'fronta ověření není přímo čitelná');
select t_login('00000000-0000-0000-0000-0000000000ad');
select t_eq((select (jsonb_array_length(admin_ares_checks()) > 0)::int), 1, 'provozovatel vidí stav ověření');
reset role;

\echo
\echo 'VŠECHNY DATABÁZOVÉ TESTY PROŠLY'
