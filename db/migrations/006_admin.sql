-- iŘemeslo – administrace provozovatele (iremeslo.cz/ssh): analytika, firmy, uživatelé, ruční platby.
--
-- Zásady:
--  * Všechno jde přes funkce security definer, které nejdřív ověří app.platform_admins.
--    Tabulky zůstávají pod RLS; provozovatel nemá přes API přímý přístup k datům firem.
--  * Provozovatel vidí jen souhrny a počty, ne obsah zakázek a dokladů.
--  * Každý zásah se zapíše do app.admin_actions (kdo, kdy, co, proč).

-- ---------------------------------------------------------------------------
-- Záznam zásahů a ruční platby předplatného
-- ---------------------------------------------------------------------------

create table app.admin_actions (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null,
  at timestamptz not null default now(),
  action text not null,
  company_id uuid references public.companies(id) on delete set null,
  target_user_id uuid,
  detail jsonb not null default '{}'::jsonb
);
create index on app.admin_actions (at desc);
alter table app.admin_actions enable row level security;
comment on table app.admin_actions is 'Zásahy provozovatele. Bez RLS politik: čte a píše jen funkce security definer.';

create table app.billing_payments (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  paid_on date not null,
  amount numeric(10,2) not null check (amount > 0),
  plan_id text not null references public.plans(id),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  period_start date not null,
  period_end date not null,
  note text,
  admin_user_id uuid not null,
  created_at timestamptz not null default now()
);
create index on app.billing_payments (company_id, paid_on desc);
alter table app.billing_payments enable row level security;
comment on table app.billing_payments is 'Platby předplatného zapsané provozovatelem (převodem). Bez RLS politik.';

-- ---------------------------------------------------------------------------
-- Ochrana příznaků firmy: provozovatel (přes funkce níže) smí přepnout režim jen pro čtení
-- ---------------------------------------------------------------------------

create or replace function app.protect_company_flags() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_setting('app.admin', true) = 'on' then
    return new;
  end if;
  if auth.uid() is not null and new.read_only is distinct from old.read_only then
    raise exception 'režim jen pro čtení řídí předplatné, ne uživatel' using errcode = '42501';
  end if;
  if auth.uid() is not null and (select read_only from public.companies where id = old.id) then
    raise exception 'účet je v režimu jen pro čtení' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Pomocné
-- ---------------------------------------------------------------------------

create or replace function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and exists (select 1 from app.platform_admins where user_id = auth.uid())
$$;

create or replace function app.require_admin() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_platform_admin() then
    raise exception 'jen pro provozovatele' using errcode = '42501';
  end if;
end $$;

create or replace function app.log_admin(p_action text, p_company uuid, p_user uuid, p_detail jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into app.admin_actions (admin_user_id, action, company_id, target_user_id, detail)
  values (auth.uid(), p_action, p_company, p_user, coalesce(p_detail, '{}'::jsonb))
$$;

-- Měsíční příjem z předplatného (bez DPH): roční tarif se dělí 12.
create or replace function app.mrr() returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(case s.billing_interval when 'year' then p.price_year / 12 else p.price_month end), 0)::numeric(12,2)
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.status = 'active' and s.plan_id <> 'beta' and (s.period_end is null or s.period_end >= current_date)
$$;

-- ---------------------------------------------------------------------------
-- Čtení
-- ---------------------------------------------------------------------------

/** Je přihlášený uživatel provozovatel? (Bez výjimky – stránka /ssh podle toho vrátí 404.) */
create or replace function public.admin_whoami() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_platform_admin()
$$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform app.require_admin();
  select jsonb_build_object(
    'companies', (select count(*) from public.companies),
    'companies_7d', (select count(*) from public.companies where created_at >= now() - interval '7 days'),
    'companies_30d', (select count(*) from public.companies where created_at >= now() - interval '30 days'),
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'users_active_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'active_companies_30d', (select count(distinct company_id) from (
        select company_id from public.jobs where updated_at >= now() - interval '30 days'
        union all select company_id from public.documents where created_at >= now() - interval '30 days') a),
    'jobs', (select count(*) from public.jobs),
    'jobs_30d', (select count(*) from public.jobs where created_at >= now() - interval '30 days'),
    'quotes', (select count(*) from public.documents where type = 'quote' and number is not null),
    'invoices', (select count(*) from public.documents where type in ('invoice', 'invoice_non_payer') and number is not null),
    'invoices_30d', (select count(*) from public.documents where type in ('invoice', 'invoice_non_payer') and number is not null and created_at >= now() - interval '30 days'),
    'paying', (select count(*) from public.subscriptions where status = 'active' and plan_id <> 'beta'),
    'read_only', (select count(*) from public.companies where read_only),
    'mrr', app.mrr(),
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w::date, 'companies', c, 'users', u) order by w), '[]'::jsonb)
      from (
        select w,
          (select count(*) from public.companies where created_at >= w and created_at < w + interval '7 days') c,
          (select count(*) from auth.users where created_at >= w and created_at < w + interval '7 days') u
        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w
      ) x)
  ) into r;
  return r;
end $$;

create or replace function public.admin_companies(p_search text default '')
returns table (
  id uuid, name text, ico text, created_at timestamptz, owner_email text, users bigint, jobs bigint, invoices bigint,
  last_activity timestamptz, plan_id text, plan_name text, sub_status text, period_end date, read_only boolean
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  return query
  select c.id, c.name, c.ico, c.created_at,
    (select u.email from public.memberships m join auth.users u on u.id = m.user_id
      where m.company_id = c.id and m.role = 'owner' order by m.created_at limit 1)::text,
    (select count(*) from public.memberships m where m.company_id = c.id),
    (select count(*) from public.jobs j where j.company_id = c.id),
    (select count(*) from public.documents d where d.company_id = c.id and d.type in ('invoice', 'invoice_non_payer') and d.number is not null),
    greatest(c.updated_at,
      (select max(j.updated_at) from public.jobs j where j.company_id = c.id),
      (select max(d.created_at) from public.documents d where d.company_id = c.id)),
    s.plan_id, p.name, s.status, s.period_end, c.read_only
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  where coalesce(p_search, '') = ''
     or c.name ilike '%' || p_search || '%'
     or c.ico = p_search
     or exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
                where m.company_id = c.id and u.email ilike '%' || p_search || '%')
  order by c.created_at desc
  limit 500;
end $$;

create or replace function public.admin_company(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform app.require_admin();
  select jsonb_build_object(
    'company', (select jsonb_build_object('id', c.id, 'name', c.name, 'ico', c.ico, 'dic', c.dic, 'city', c.city,
                  'email', c.email, 'phone', c.phone, 'vat_payer', c.vat_payer, 'read_only', c.read_only, 'created_at', c.created_at)
                from public.companies c where c.id = p_company),
    'subscription', (select jsonb_build_object('plan_id', s.plan_id, 'status', s.status, 'period_start', s.period_start,
                  'period_end', s.period_end, 'billing_interval', s.billing_interval)
                from public.subscriptions s where s.company_id = p_company),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'email', u.email, 'role', m.role,
                  'last_sign_in_at', u.last_sign_in_at, 'banned', coalesce(u.banned_until > now(), false)) order by m.created_at), '[]'::jsonb)
                from public.memberships m join auth.users u on u.id = m.user_id where m.company_id = p_company),
    'counts', jsonb_build_object(
      'jobs', (select count(*) from public.jobs where company_id = p_company),
      'clients', (select count(*) from public.clients where company_id = p_company),
      'quotes', (select count(*) from public.documents where company_id = p_company and type = 'quote' and number is not null),
      'invoices', (select count(*) from public.documents where company_id = p_company and type in ('invoice', 'invoice_non_payer') and number is not null)),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('paid_on', b.paid_on, 'amount', b.amount, 'plan_id', b.plan_id,
                  'billing_interval', b.billing_interval, 'period_start', b.period_start, 'period_end', b.period_end, 'note', b.note) order by b.paid_on desc), '[]'::jsonb)
                from app.billing_payments b where b.company_id = p_company),
    'actions', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'detail', a.detail) order by a.at desc), '[]'::jsonb)
                from (select * from app.admin_actions where company_id = p_company order by at desc limit 30) a)
  ) into r;
  if r -> 'company' = 'null'::jsonb then raise exception 'firma nenalezena'; end if;
  return r;
end $$;

create or replace function public.admin_users(p_search text default '')
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, banned boolean, is_admin boolean, companies jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, coalesce(u.banned_until > now(), false),
    exists (select 1 from app.platform_admins a where a.user_id = u.id),
    (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role', m.role)), '[]'::jsonb)
       from public.memberships m join public.companies c on c.id = m.company_id where m.user_id = u.id)
  from auth.users u
  where coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%'
  order by u.created_at desc nulls last
  limit 500;
end $$;

create or replace function public.admin_billing() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform app.require_admin();
  select jsonb_build_object(
    'mrr', app.mrr(),
    'paying', (select count(*) from public.subscriptions where status = 'active' and plan_id <> 'beta'),
    'received_30d', (select coalesce(sum(amount), 0) from app.billing_payments where paid_on >= current_date - 30),
    'received_year', (select coalesce(sum(amount), 0) from app.billing_payments where paid_on >= date_trunc('year', current_date)),
    'plans', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price_month', p.price_month, 'price_year', p.price_year,
                'is_public', p.is_public, 'companies', (select count(*) from public.subscriptions s where s.plan_id = p.id)) order by p.sort)
              from public.plans p),
    'due', (select coalesce(jsonb_agg(jsonb_build_object('company_id', c.id, 'name', c.name, 'plan_id', s.plan_id,
                'status', s.status, 'period_end', s.period_end, 'read_only', c.read_only) order by s.period_end), '[]'::jsonb)
              from public.subscriptions s join public.companies c on c.id = s.company_id
              where s.plan_id <> 'beta' and s.period_end is not null and s.period_end <= current_date + 14),
    'recent', (select coalesce(jsonb_agg(x order by x ->> 'paid_on' desc), '[]'::jsonb) from (
                select jsonb_build_object('company_id', c.id, 'name', c.name, 'paid_on', b.paid_on, 'amount', b.amount,
                  'plan_id', b.plan_id, 'period_end', b.period_end) x
                from app.billing_payments b join public.companies c on c.id = b.company_id
                order by b.paid_on desc, b.id desc limit 30) t)
  ) into r;
  return r;
end $$;

create or replace function public.admin_actions_recent(p_limit int default 20)
returns table (at timestamptz, action text, company_id uuid, company_name text, target_email text, detail jsonb, admin_email text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  return query
  select a.at, a.action, a.company_id, c.name, tu.email::text, a.detail, au.email::text
  from app.admin_actions a
  left join public.companies c on c.id = a.company_id
  left join auth.users tu on tu.id = a.target_user_id
  left join auth.users au on au.id = a.admin_user_id
  order by a.at desc
  limit least(greatest(p_limit, 1), 200);
end $$;

-- ---------------------------------------------------------------------------
-- Zásahy
-- ---------------------------------------------------------------------------

/** Zablokuje / odblokuje uživatele. Blokovaný se nepřihlásí a jeho přihlášení se ukončí. */
create or replace function public.admin_set_user_banned(p_user uuid, p_banned boolean, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  if p_user = auth.uid() then raise exception 'sám sebe zablokovat nejde'; end if;
  if length(coalesce(trim(p_reason), '')) < 3 then raise exception 'uveďte důvod'; end if;
  if exists (select 1 from app.platform_admins where user_id = p_user) then raise exception 'provozovatele zablokovat nejde'; end if;
  update auth.users set banned_until = case when p_banned then 'infinity'::timestamptz else null end where id = p_user;
  if not found then raise exception 'uživatel nenalezen'; end if;
  if p_banned then delete from auth.sessions where user_id = p_user; end if;
  perform app.log_admin(case when p_banned then 'user_ban' else 'user_unban' end, null, p_user, jsonb_build_object('reason', p_reason));
end $$;

/** Přepne režim jen pro čtení (data zůstanou, nejde zapisovat). */
create or replace function public.admin_set_read_only(p_company uuid, p_value boolean, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  if length(coalesce(trim(p_reason), '')) < 3 then raise exception 'uveďte důvod'; end if;
  perform set_config('app.admin', 'on', true);
  update public.companies set read_only = p_value where id = p_company;
  if not found then raise exception 'firma nenalezena'; end if;
  update public.subscriptions set status = case when p_value then 'read_only'
      when status = 'read_only' then 'active' else status end
    where company_id = p_company;
  perform set_config('app.admin', 'off', true);
  perform app.log_admin(case when p_value then 'read_only_on' else 'read_only_off' end, p_company, null, jsonb_build_object('reason', p_reason));
end $$;

/** Ruční změna tarifu (např. přechod z bety, sleva, prodloužení zkušební doby). */
create or replace function public.admin_set_subscription(p_company uuid, p_plan text, p_status text, p_period_end date, p_interval text, p_note text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare old jsonb;
begin
  perform app.require_admin();
  if p_status not in ('trialing', 'active', 'past_due', 'canceled') then raise exception 'neplatný stav předplatného'; end if;
  if p_interval is not null and p_interval not in ('month', 'year') then raise exception 'neplatné období'; end if;
  if not exists (select 1 from public.plans where id = p_plan) then raise exception 'neznámý tarif'; end if;
  select to_jsonb(s) into old from public.subscriptions s where s.company_id = p_company;
  insert into public.subscriptions (company_id, plan_id, status, period_end, billing_interval)
  values (p_company, p_plan, p_status, p_period_end, p_interval)
  on conflict (company_id) do update set plan_id = excluded.plan_id, status = excluded.status,
    period_end = excluded.period_end, billing_interval = excluded.billing_interval;
  perform app.log_admin('subscription', p_company, null, jsonb_build_object(
    'plan', p_plan, 'status', p_status, 'period_end', p_period_end, 'interval', p_interval, 'note', p_note,
    'before', old - 'company_id' - 'updated_at'));
end $$;

/**
 * Zapíše platbu předplatného (převodem) a prodlouží období o měsíc / rok:
 * od konce dosavadního období, nebo od data platby, když už období skončilo.
 * Zaplacená firma vyjde z režimu jen pro čtení.
 */
create or replace function public.admin_record_payment(p_company uuid, p_amount numeric, p_paid_on date, p_plan text, p_interval text, p_note text)
returns date
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cur_end date;
  start_d date;
  end_d date;
begin
  perform app.require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'částka musí být kladná'; end if;
  if p_paid_on is null or p_paid_on > current_date then raise exception 'neplatné datum platby'; end if;
  if p_interval not in ('month', 'year') then raise exception 'neplatné období'; end if;
  if p_plan = 'beta' or not exists (select 1 from public.plans where id = p_plan) then raise exception 'vyberte placený tarif'; end if;
  if not exists (select 1 from public.companies where id = p_company) then raise exception 'firma nenalezena'; end if;

  select period_end into cur_end from public.subscriptions where company_id = p_company and plan_id <> 'beta';
  start_d := greatest(coalesce(cur_end, p_paid_on), p_paid_on);
  end_d := (start_d + case p_interval when 'year' then interval '1 year' else interval '1 month' end)::date;

  insert into app.billing_payments (company_id, paid_on, amount, plan_id, billing_interval, period_start, period_end, note, admin_user_id)
  values (p_company, p_paid_on, p_amount, p_plan, p_interval, start_d, end_d, nullif(trim(p_note), ''), auth.uid());

  insert into public.subscriptions (company_id, plan_id, status, period_start, period_end, billing_interval, failed_payments)
  values (p_company, p_plan, 'active', start_d, end_d, p_interval, 0)
  on conflict (company_id) do update set plan_id = excluded.plan_id, status = 'active', period_end = excluded.period_end,
    billing_interval = excluded.billing_interval, failed_payments = 0;

  perform set_config('app.admin', 'on', true);
  update public.companies set read_only = false where id = p_company and read_only;
  perform set_config('app.admin', 'off', true);

  perform app.log_admin('payment', p_company, null, jsonb_build_object('amount', p_amount, 'paid_on', p_paid_on, 'plan', p_plan,
    'interval', p_interval, 'period_end', end_d, 'note', p_note));
  return end_d;
end $$;

-- ---------------------------------------------------------------------------
-- Práva: funkce smí volat přihlášený uživatel, ale bez záznamu v platform_admins skončí výjimkou.
-- ---------------------------------------------------------------------------

revoke all on function app.is_platform_admin(), app.require_admin(), app.log_admin(text, uuid, uuid, jsonb), app.mrr() from public;
revoke all on function
  public.admin_whoami(), public.admin_overview(), public.admin_companies(text), public.admin_company(uuid), public.admin_users(text),
  public.admin_billing(), public.admin_actions_recent(int), public.admin_set_user_banned(uuid, boolean, text),
  public.admin_set_read_only(uuid, boolean, text), public.admin_set_subscription(uuid, text, text, date, text, text),
  public.admin_record_payment(uuid, numeric, date, text, text, text)
from public, anon;
grant execute on function
  public.admin_whoami(), public.admin_overview(), public.admin_companies(text), public.admin_company(uuid), public.admin_users(text),
  public.admin_billing(), public.admin_actions_recent(int), public.admin_set_user_banned(uuid, boolean, text),
  public.admin_set_read_only(uuid, boolean, text), public.admin_set_subscription(uuid, text, text, date, text, text),
  public.admin_record_payment(uuid, numeric, date, text, text, text)
to authenticated;
