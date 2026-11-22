-- iŘemeslo – databázové schéma (PostgreSQL 15+ / Supabase)
-- Pravidla:
--  * každá tabulka kromě companies, plans a units nese company_id;
--  * vazby mezi tabulkami jdou přes (company_id, id), takže řádek nikdy nemůže ukazovat do cizí firmy
--    (cizí klíče obcházejí RLS, proto se firma hlídá i v klíči);
--  * peníze numeric(14,2), množství numeric(12,2) – nikdy float.

-- V Supabase je pgcrypto ve schématu extensions; lokálně ho tam založíme taky.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Pomocné
-- ---------------------------------------------------------------------------

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tarify a firmy
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key,
  name text not null,
  max_users int,                       -- null = bez limitu
  max_active_jobs_per_month int,       -- null = bez limitu
  price_month numeric(10,2) not null default 0,  -- bez DPH
  price_year numeric(10,2) not null default 0,   -- bez DPH
  is_public boolean not null default true,
  sort int not null default 0
);

insert into public.plans (id, name, max_users, max_active_jobs_per_month, price_month, price_year, is_public, sort) values
  ('beta',       'Beta zdarma',        null, null,   0,    0, true,  0),
  ('zakladni',   'Základní (1–5 uživatelů)', 5,    null, 199, 1999, false, 1),
  ('bez_limitu', 'Bez limitu',          null, null, 299, 2999, false, 2);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  ico text check (ico ~ '^\d{8}$'),
  dic text check (dic ~ '^[A-Z]{2}[0-9A-Z]{2,12}$'),
  street text,
  city text,
  zip text,
  country text not null default 'CZ',
  register_entry text,                 -- zápis v OR / živnostenském rejstříku
  email text,
  phone text,
  web text,
  logo_path text,
  stamp_path text,
  signature_path text,
  bank_account text,
  iban text,
  bic text,
  vat_payer boolean not null default false,
  default_vat_rate smallint not null default 21 check (default_vat_rate in (0, 12, 21)),
  payment_terms_days int not null default 14 check (payment_terms_days between 0 and 365),
  material_markup_pct numeric(6,2) not null default 0 check (material_markup_pct >= 0),
  min_margin_pct numeric(5,2) not null default 15,
  invoice_theme text not null default 'oranzova' check (invoice_theme in ('oranzova', 'svetlemodra', 'zelena', 'mono')),
  doc_texts jsonb not null default '{}'::jsonb,
  read_only boolean not null default false,  -- po neuhrazeném předplatném: data zůstanou, jen čtení
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_touch before update on public.companies for each row execute function app.touch_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'office', 'worker')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('office', 'worker')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.invitations (company_id);

create table public.subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'read_only', 'canceled')),
  period_start date not null default current_date,
  period_end date,
  billing_interval text check (billing_interval in ('month', 'year')),
  provider text,                       -- 'stripe' / 'comgate' / 'gopay' – až se začne účtovat
  provider_customer_id text,
  provider_subscription_id text,
  failed_payments int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger subscriptions_touch before update on public.subscriptions for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Číselníky
-- ---------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,  -- null = společná jednotka
  code text not null check (length(code) between 1 and 12),
  sort int not null default 100
);
create unique index units_global_code on public.units (code) where company_id is null;
create unique index units_company_code on public.units (company_id, code) where company_id is not null;

insert into public.units (code, sort) values
  ('m²', 1), ('m³', 2), ('bm', 3), ('ks', 4), ('l', 5), ('kg', 6), ('m', 7), ('hod', 8), ('den', 9), ('bal.', 10), ('paušál', 11);

-- ---------------------------------------------------------------------------
-- Klienti, zaměstnanci, ceník
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('company', 'person')),
  name text not null,
  ico text check (ico ~ '^\d{8}$'),
  dic text,
  street text, city text, zip text, country text not null default 'CZ',
  email text, phone text,
  contact_person text,
  note text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);
create trigger clients_touch before update on public.clients for each row execute function app.touch_updated_at();

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text, phone text,
  rate_hour numeric(12,2) not null default 0 check (rate_hour >= 0),
  rate_day numeric(12,2) not null default 0 check (rate_day >= 0),
  user_id uuid references auth.users(id) on delete set null,  -- pracovník s přihlášením
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);
create index on public.employees (user_id);
create trigger employees_touch before update on public.employees for each row execute function app.touch_updated_at();

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('work', 'material')),
  name text not null,
  unit text not null,
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);
create index catalog_items_search on public.catalog_items (company_id, kind, lower(name));
create trigger catalog_items_touch before update on public.catalog_items for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Zakázky
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number text not null,                -- Z-2026-0001
  title text not null,
  status text not null default 'inquiry'
    check (status in ('inquiry', 'quote_sent', 'approved', 'in_progress', 'done', 'invoiced', 'paid', 'rejected')),
  client_id uuid,
  site_address text,
  map_url text,
  date_from date,
  date_to date,
  time_from time,
  time_to time,
  vat_mode text not null default 'standard' check (vat_mode in ('standard', 'reverse_charge', 'non_payer')),
  vat_rate smallint not null default 21 check (vat_rate in (0, 12, 21)),
  discount_kind text check (discount_kind in ('percent', 'amount')),
  discount_value numeric(14,2) check (discount_value >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, number),
  check (date_to is null or date_from is null or date_to >= date_from),
  check ((discount_kind is null) = (discount_value is null)),
  check (discount_kind <> 'percent' or discount_value <= 100),
  foreign key (company_id, client_id) references public.clients (company_id, id)
);
create index jobs_calendar on public.jobs (company_id, date_from, date_to);
create index jobs_status on public.jobs (company_id, status);
create trigger jobs_touch before update on public.jobs for each row execute function app.touch_updated_at();

create table public.job_work_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null,
  position int not null default 0,
  description text not null,
  qty numeric(12,2) not null default 0,
  unit text not null,
  unit_price numeric(14,2) not null default 0,
  catalog_item_id uuid,
  foreign key (company_id, job_id) references public.jobs (company_id, id) on delete cascade,
  foreign key (company_id, catalog_item_id) references public.catalog_items (company_id, id)
);
create index on public.job_work_items (company_id, job_id, position);

create table public.job_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null,
  position int not null default 0,
  description text not null,
  qty_planned numeric(12,2) not null default 0,
  qty_actual numeric(12,2),
  unit text not null,
  purchase_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  billable boolean not null default true,
  catalog_item_id uuid,
  foreign key (company_id, job_id) references public.jobs (company_id, id) on delete cascade,
  foreign key (company_id, catalog_item_id) references public.catalog_items (company_id, id)
);
create index on public.job_materials (company_id, job_id, position);

create table public.job_labor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null,
  position int not null default 0,
  employee_id uuid not null,
  qty_planned numeric(12,2) not null default 0,
  qty_actual numeric(12,2),
  unit text not null check (unit in ('hod', 'den')),
  rate numeric(14,2) not null default 0,
  foreign key (company_id, job_id) references public.jobs (company_id, id) on delete cascade,
  foreign key (company_id, employee_id) references public.employees (company_id, id)
);
create index on public.job_labor (company_id, job_id, position);
create index on public.job_labor (company_id, employee_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid,
  kind text not null check (kind in ('photo_before', 'photo_after', 'receipt', 'other')),
  path text not null,                  -- cesta v úložišti: <company_id>/<job_id>/<soubor>
  mime text,
  size_bytes bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, job_id) references public.jobs (company_id, id) on delete cascade,
  check (path like company_id::text || '/%')
);

create table public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null,
  position int not null default 0,
  description text not null,
  qty_planned numeric(12,2) not null default 1,
  qty_actual numeric(12,2),
  unit_price numeric(14,2) not null default 0,
  receipt_id uuid,
  foreign key (company_id, job_id) references public.jobs (company_id, id) on delete cascade,
  foreign key (company_id, receipt_id) references public.attachments (company_id, id) on delete set null (receipt_id)
);
create index on public.job_expenses (company_id, job_id, position);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null,
  employee_id uuid not null,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (company_id, job_id) references public.jobs (company_id, id) on delete cascade,
  foreign key (company_id, employee_id) references public.employees (company_id, id)
);
create index on public.time_entries (company_id, employee_id, work_date);

-- ---------------------------------------------------------------------------
-- Doklady
-- ---------------------------------------------------------------------------

create table public.number_series (
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null,
  year int not null,
  format text not null,
  next_seq int not null default 1 check (next_seq >= 1),
  primary key (company_id, doc_type, year)
);

create table public.series_formats (
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null,
  format text not null,
  primary key (company_id, doc_type)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid,
  client_id uuid,
  type text not null check (type in ('quote', 'advance', 'ddpp', 'invoice', 'invoice_non_payer', 'credit_note', 'contract', 'handover')),
  number text,                         -- přidělí se při vystavení (draft = null)
  status text not null default 'draft' check (status in ('draft', 'issued', 'sent', 'paid', 'canceled')),
  issue_date date,
  taxable_date date,                   -- DUZP
  due_date date,
  valid_until date,                    -- platnost nabídky
  vat_mode text not null check (vat_mode in ('standard', 'reverse_charge', 'non_payer')),
  currency text not null default 'CZK',
  total_due numeric(14,2) not null default 0,
  snapshot jsonb not null default '{}'::jsonb,  -- dodavatel, odběratel, položky a součty v okamžiku vystavení
  pdf_path text,
  related_document_id uuid,            -- dobropis → faktura, DDPP → záloha
  approval_token_hash text unique,     -- odkaz „Schválit nabídku“ pro zákazníka
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, job_id) references public.jobs (company_id, id) on delete restrict,
  foreign key (company_id, client_id) references public.clients (company_id, id) on delete restrict,
  foreign key (company_id, related_document_id) references public.documents (company_id, id),
  check (status = 'draft' or number is not null),
  check (type <> 'ddpp' or related_document_id is not null),
  check (type <> 'credit_note' or related_document_id is not null)
);
create unique index documents_number on public.documents (company_id, type, number) where number is not null;
create index documents_list on public.documents (company_id, type, issue_date desc);
create index documents_job on public.documents (company_id, job_id);
create trigger documents_touch before update on public.documents for each row execute function app.touch_updated_at();

-- Odečet zálohy na ostré faktuře. unique(advance_id) = jednu zálohu lze odečíst jen jednou.
create table public.advance_deductions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  invoice_id uuid not null,
  advance_id uuid not null unique,
  base numeric(14,2) not null,
  vat numeric(14,2) not null,
  vat_rate smallint not null check (vat_rate in (0, 12, 21)),
  created_at timestamptz not null default now(),
  foreign key (company_id, invoice_id) references public.documents (company_id, id) on delete cascade,
  foreign key (company_id, advance_id) references public.documents (company_id, id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  document_id uuid not null,
  paid_on date not null,
  amount numeric(14,2) not null check (amount <> 0),
  method text not null default 'bank' check (method in ('bank', 'cash', 'card', 'other')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete restrict
);
create index on public.payments (company_id, document_id);

-- ---------------------------------------------------------------------------
-- Audit a provozovatel
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor uuid,
  at timestamptz not null default now(),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  diff jsonb
);
create index on public.audit_log (company_id, at desc);

-- Provozovatel (superadmin). Do dat firem nemá přístup přes RLS; podpora jde přes funkci,
-- která každý přístup zapíše do support_access_log.
create table app.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.support_access_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  reason text not null check (length(reason) >= 5),
  at timestamptz not null default now()
);
