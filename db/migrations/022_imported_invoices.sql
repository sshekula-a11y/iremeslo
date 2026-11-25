-- iŘemeslo – faktury převzaté z jiných programů (PDF z FakturaOnline, Fakturoidu…, ISDOC).
--
-- Jsou odděleně od dokladů vystavených v iRemeslo: nemají vlastní číselnou řadu aplikace, nedají se
-- měnit jako vystavené doklady a nepočítají se do čísel aplikace. PDF leží v soukromém úložišti files
-- ve složce firmy (<firma>/imports/<id>.pdf), takže ho vidí jen majitel a kancelář.

create table if not exists public.imported_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('invoice', 'advance')),
  number text not null check (length(number) between 1 and 40),
  issue_date date,
  due_date date,
  customer_name text not null check (length(customer_name) between 1 and 200),
  customer_ico text check (customer_ico ~ '^\d{8}$'),
  client_id uuid references public.clients(id) on delete set null,
  total numeric(14, 2) not null default 0,
  currency text not null default 'CZK' check (currency ~ '^[A-Z]{3}$'),
  paid_on date,
  source text check (length(source) <= 60),
  pdf_path text check (pdf_path is null or pdf_path ~ '^[0-9a-f-]{36}/imports/[0-9a-f-]{36}\.pdf$'),
  created_at timestamptz not null default now(),
  unique (company_id, kind, number)
);
create index if not exists imported_invoices_company_idx on public.imported_invoices (company_id, issue_date desc);
alter table public.imported_invoices enable row level security;

drop policy if exists imported_invoices_read on public.imported_invoices;
create policy imported_invoices_read on public.imported_invoices for select using (app.is_staff(company_id));
drop policy if exists imported_invoices_insert on public.imported_invoices;
create policy imported_invoices_insert on public.imported_invoices for insert
  with check (app.can_write(company_id) and (pdf_path is null or split_part(pdf_path, '/', 1) = company_id::text));
drop policy if exists imported_invoices_update on public.imported_invoices;
create policy imported_invoices_update on public.imported_invoices for update
  using (app.can_write(company_id)) with check (app.can_write(company_id) and (pdf_path is null or split_part(pdf_path, '/', 1) = company_id::text));
drop policy if exists imported_invoices_delete on public.imported_invoices;
create policy imported_invoices_delete on public.imported_invoices for delete using (app.can_write(company_id));
grant select, insert, update, delete on public.imported_invoices to authenticated;
