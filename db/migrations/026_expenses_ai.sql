-- iŘemeslo – AI účetní, 1. část: výdaje (účtenky a přijaté faktury) a měsíční limity AI.
-- Výdaj zadá řemeslník ručně, nebo vyfotí účtenku a údaje přečte AI (Claude); před uložením je vždy zkontroluje.
-- Soubor účtenky leží v soukromém úložišti „files“ ve složce <company_id>/expenses/.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null default 'receipt' check (kind in ('receipt', 'invoice')),
  supplier_name text not null check (length(btrim(supplier_name)) between 1 and 200),
  supplier_ico text check (supplier_ico is null or supplier_ico ~ '^\d{8}$'),
  doc_number text check (doc_number is null or length(doc_number) <= 60),
  issue_date date not null,
  total numeric(14, 2) not null check (total >= 0 and total < 100000000),
  vat_base numeric(14, 2) check (vat_base is null or vat_base >= 0),
  vat numeric(14, 2) check (vat is null or vat >= 0),
  currency text not null default 'CZK' check (currency ~ '^[A-Z]{3}$'),
  category text not null default 'jine' check (category in (
    'material', 'subdodavky', 'phm', 'naradi', 'auto', 'telefon', 'najem', 'pojisteni', 'reklama', 'kancelar', 'jine')),
  description text check (description is null or length(description) <= 500),
  paid_method text not null default 'card' check (paid_method in ('cash', 'bank', 'card', 'other')),
  job_id uuid references public.jobs(id) on delete set null,
  file_path text,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_path is null or split_part(file_path, '/', 1) = company_id::text and split_part(file_path, '/', 2) = 'expenses')
);
create index if not exists expenses_company_date_idx on public.expenses (company_id, issue_date desc);

alter table public.expenses enable row level security;
drop policy if exists expenses_read on public.expenses;
create policy expenses_read on public.expenses for select using (app.is_staff(company_id));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert with check (app.can_write(company_id));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update using (app.can_write(company_id)) with check (app.can_write(company_id));
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete using (app.can_write(company_id));
grant select, insert, update, delete on public.expenses to authenticated;

-- Zakázka výdaje musí patřit stejné firmě.
create or replace function app.expenses_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.job_id is not null and not exists (select 1 from public.jobs j where j.id = new.job_id and j.company_id = new.company_id) then
    raise exception 'zakázka nepatří firmě' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists expenses_check on public.expenses;
create trigger expenses_check before insert or update on public.expenses for each row execute function app.expenses_check();

-- ---------- spotřeba AI a měsíční limity ----------
create table if not exists app.ai_usage (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('receipt', 'chat')),
  created_at timestamptz not null default now(),
  ok boolean,                      -- null = běží, false = selhalo (nepočítá se do limitu)
  input_tokens int,
  output_tokens int,
  model text
);
create index if not exists ai_usage_company_idx on app.ai_usage (company_id, kind, created_at);
alter table app.ai_usage enable row level security;

insert into app.settings (key, value) values ('ai_receipts_month', '100'), ('ai_chat_month', '200')
on conflict (key) do nothing;

create or replace function app.ai_used(p_company uuid, p_kind text) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from app.ai_usage
  where company_id = p_company and kind = p_kind and ok is not false
    and created_at >= date_trunc('month', now() at time zone 'Europe/Prague') at time zone 'Europe/Prague'
$$;

/** Kolik AI firma tento měsíc využila a kolik smí. */
create or replace function public.ai_quota(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_staff(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  return jsonb_build_object(
    'receipts_used', app.ai_used(p_company, 'receipt'), 'receipts_limit', coalesce(app.setting('ai_receipts_month')::int, 0),
    'chat_used', app.ai_used(p_company, 'chat'), 'chat_limit', coalesce(app.setting('ai_chat_month')::int, 0));
end $$;
revoke all on function public.ai_quota(uuid) from public, anon;
grant execute on function public.ai_quota(uuid) to authenticated;

/** Rezervuje jedno použití AI v rámci měsíčního limitu; vrátí id záznamu, nebo chybu „limit“. */
create or replace function public.ai_reserve(p_company uuid, p_kind text) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  lim int := coalesce(app.setting(case p_kind when 'receipt' then 'ai_receipts_month' else 'ai_chat_month' end)::int, 0);
  rid bigint;
begin
  if p_kind not in ('receipt', 'chat') then raise exception 'neznámý druh' using errcode = '22023'; end if;
  if not app.can_write(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('ai:' || p_company::text || p_kind));
  if app.ai_used(p_company, p_kind) >= lim then raise exception 'vyčerpaný měsíční limit AI' using errcode = 'P0001'; end if;
  insert into app.ai_usage (company_id, user_id, kind) values (p_company, auth.uid(), p_kind) returning id into rid;
  return rid;
end $$;
revoke all on function public.ai_reserve(uuid, text) from public, anon;
grant execute on function public.ai_reserve(uuid, text) to authenticated;

/** Zapíše výsledek volání AI (tokeny pro přehled nákladů v administraci). */
create or replace function public.ai_finish(p_id bigint, p_ok boolean, p_input int, p_output int, p_model text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update app.ai_usage set ok = p_ok, input_tokens = p_input, output_tokens = p_output, model = left(p_model, 60)
  where id = p_id and user_id = auth.uid() and ok is null
$$;
revoke all on function public.ai_finish(bigint, boolean, int, int, text) from public, anon;
grant execute on function public.ai_finish(bigint, boolean, int, int, text) to authenticated;

/** Administrace: limity a spotřeba AI za tento měsíc po firmách. */
create or replace function public.admin_ai_overview() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Prague') at time zone 'Europe/Prague';
begin
  perform app.require_admin();
  return jsonb_build_object(
    'receipts_limit', coalesce(app.setting('ai_receipts_month')::int, 0),
    'chat_limit', coalesce(app.setting('ai_chat_month')::int, 0),
    'companies', coalesce((
      select jsonb_agg(x order by x->>'name') from (
        select jsonb_build_object('name', c.name,
          'receipts', count(*) filter (where u.kind = 'receipt' and u.ok),
          'chat', count(*) filter (where u.kind = 'chat' and u.ok),
          'failed', count(*) filter (where u.ok = false),
          'input_tokens', coalesce(sum(u.input_tokens), 0), 'output_tokens', coalesce(sum(u.output_tokens), 0)) x
        from app.ai_usage u join public.companies c on c.id = u.company_id
        where u.created_at >= month_start
        group by c.id, c.name) t), '[]'::jsonb));
end $$;
revoke all on function public.admin_ai_overview() from public, anon;
grant execute on function public.admin_ai_overview() to authenticated;

create or replace function public.admin_set_ai_limits(p_receipts int, p_chat int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  if p_receipts not between 0 and 100000 or p_chat not between 0 and 100000 then raise exception 'neplatný limit' using errcode = '22023'; end if;
  update app.settings set value = p_receipts::text, updated_at = now() where key = 'ai_receipts_month';
  update app.settings set value = p_chat::text, updated_at = now() where key = 'ai_chat_month';
end $$;
revoke all on function public.admin_set_ai_limits(int, int) from public, anon;
grant execute on function public.admin_set_ai_limits(int, int) to authenticated;
