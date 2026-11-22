-- iŘemeslo – zkušební období 30 dní jednou na IČO.
--
-- Zkušební období se váže na IČO, ne na e-mail ani účet: kdo založí firmu se stejným IČO znovu
-- (jiný e-mail, nový účet, smazaná a znovu založená firma), nedostane dalších 30 dní zdarma.
-- Po skončení zkušebního období (nebo předplatného) firma data vidí, ale nemůže zapisovat.

insert into public.plans (id, name, max_users, max_active_jobs_per_month, price_month, price_year, is_public, sort)
values ('zkusebni', 'Zkušební 30 dní', null, null, 0, 0, true, 0)
on conflict (id) do nothing;
-- Beta zdarma už se veřejně nenabízí; provozovatel ji může firmě přidělit ručně (bez konce).
update public.plans set is_public = false where id = 'beta';

-- Kdy které IČO začalo čerpat zkušební období. Záměrně bez cizího klíče na firmu:
-- záznam zůstane i po smazání firmy, jinak by šlo období získat znovu.
create table app.trial_claims (
  ico text primary key check (ico ~ '^\d{8}$'),
  first_company_id uuid,
  first_user_id uuid,
  claimed_at timestamptz not null default now(),
  trial_end date not null
);
alter table app.trial_claims enable row level security;
comment on table app.trial_claims is 'Zkušební období podle IČO (jednou na IČO). Bez RLS politik: jen funkce security definer.';

-- Délka zkušebního období a tolerance po skončení placeného období (platba převodem může chvíli trvat).
create or replace function app.trial_days() returns int language sql immutable as $$ select 30 $$;
create or replace function app.grace_days() returns int language sql immutable as $$ select 7 $$;

/** Má firma platné předplatné nebo běžící zkušební období? */
create or replace function app.subscription_ok(p_company uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case
      when s.status = 'trialing' then s.period_end is not null and s.period_end >= current_date
      when s.status in ('active', 'past_due') then s.period_end is null or s.period_end + app.grace_days() >= current_date
      else false
    end
    from public.subscriptions s where s.company_id = p_company
  ), true)
$$;

-- Zápis: majitel a kancelář, firma není jen pro čtení a má platné předplatné / zkušební období.
create or replace function app.can_write(p_company uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_staff(p_company)
     and not coalesce((select c.read_only from public.companies c where c.id = p_company), true)
     and app.subscription_ok(p_company)
$$;

/**
 * Stav zkušebního období pro IČO (formulář založení firmy to ukáže hned po zadání IČO).
 * Vrací jen to, zda a do kdy bylo období čerpáno – žádné údaje o firmě.
 */
create or replace function public.trial_for_ico(p_ico text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c app.trial_claims%rowtype;
begin
  if auth.uid() is null then raise exception 'nejste přihlášený' using errcode = '42501'; end if;
  if p_ico !~ '^\d{8}$' then return jsonb_build_object('used', false); end if;
  select * into c from app.trial_claims where ico = p_ico;
  if not found then return jsonb_build_object('used', false, 'days', app.trial_days()); end if;
  return jsonb_build_object('used', true, 'trial_end', c.trial_end, 'active', c.trial_end >= current_date);
end $$;

-- Založení firmy: IČO je povinné; zkušební období se počítá od prvního založení firmy s tímto IČO.
drop function if exists public.register_company(text, text, text, text, text, text, boolean);
create function public.register_company(
  p_name text,
  p_ico text default null,
  p_dic text default null,
  p_street text default null,
  p_city text default null,
  p_zip text default null,
  p_vat_payer boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  claim app.trial_claims%rowtype;
begin
  if uid is null then raise exception 'nejste přihlášený' using errcode = '42501'; end if;
  if coalesce(p_ico, '') !~ '^\d{8}$' then raise exception 'IČO je povinné (8 číslic)'; end if;
  if (select count(*) from public.memberships where user_id = uid and role = 'owner') >= 5 then
    raise exception 'jeden uživatel může založit nejvýš 5 firem';
  end if;

  insert into public.companies (name, ico, dic, street, city, zip, vat_payer, default_vat_rate)
  values (p_name, p_ico, nullif(p_dic, ''), p_street, p_city, p_zip, p_vat_payer, case when p_vat_payer then 21 else 0 end)
  returning id into cid;
  insert into public.memberships (company_id, user_id, role) values (cid, uid, 'owner');

  -- Zámek řádku: dvě současné registrace stejného IČO nedostanou dvě období.
  insert into app.trial_claims (ico, first_company_id, first_user_id, trial_end)
  values (p_ico, cid, uid, current_date + app.trial_days())
  on conflict (ico) do nothing;
  select * into claim from app.trial_claims where ico = p_ico for update;

  insert into public.subscriptions (company_id, plan_id, status, period_start, period_end)
  values (cid, 'zkusebni', 'trialing', claim.claimed_at::date, claim.trial_end);
  return cid;
end $$;
revoke all on function public.register_company(text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.register_company(text, text, text, text, text, text, boolean) to authenticated;

revoke all on function app.subscription_ok(uuid), app.trial_days(), app.grace_days() from public;
grant execute on function app.subscription_ok(uuid) to authenticated;
revoke all on function public.trial_for_ico(text) from public, anon;
grant execute on function public.trial_for_ico(text) to authenticated;

-- Stav předplatného pro přihlášeného člena firmy (pruh „zkušební období do…“ v aplikaci).
create or replace function public.my_subscription(p_company uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when app.is_member(p_company) then (
    select jsonb_build_object('plan_id', s.plan_id, 'status', s.status, 'period_end', s.period_end,
      'ok', app.subscription_ok(p_company), 'grace_days', app.grace_days())
    from public.subscriptions s where s.company_id = p_company) end
$$;
revoke all on function public.my_subscription(uuid) from public, anon;
grant execute on function public.my_subscription(uuid) to authenticated;
