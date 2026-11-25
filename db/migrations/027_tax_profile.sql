-- iŘemeslo – AI účetní, 2. část: daňový profil firmy (pro odhad daně, pojistného a termíny).
create table if not exists public.tax_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  legal_form text not null default 'osvc' check (legal_form in ('osvc', 'po')),
  flat_rate smallint not null default 80 check (flat_rate in (80, 60, 40)),
  regime text not null default 'flat_expenses' check (regime in ('actual', 'flat_expenses', 'flat_tax')),
  updated_at timestamptz not null default now()
);
alter table public.tax_profiles enable row level security;
drop policy if exists tax_profiles_read on public.tax_profiles;
create policy tax_profiles_read on public.tax_profiles for select using (app.is_staff(company_id));
drop policy if exists tax_profiles_write on public.tax_profiles;
create policy tax_profiles_write on public.tax_profiles for insert with check (app.can_write(company_id));
drop policy if exists tax_profiles_update on public.tax_profiles;
create policy tax_profiles_update on public.tax_profiles for update using (app.can_write(company_id)) with check (app.can_write(company_id));
grant select, insert, update on public.tax_profiles to authenticated;
