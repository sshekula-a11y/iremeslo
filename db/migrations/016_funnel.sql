-- iŘemeslo – konverzní přehled v /ssh přímo z databáze (úplná čísla, nezávislá na souhlasu s cookies).
--
-- Poptávky se po čase mažou (úklid, GDPR), proto se jejich události zapisují do app.funnel_log
-- bez osobních údajů: kdy, jaká událost, kategorie a kraj. Ukázkové poptávky se nezapisují.

create table if not exists app.funnel_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event text not null check (event in ('inquiry_submitted', 'inquiry_confirmed', 'contact_view')),
  category text,
  region text
);
create index if not exists funnel_log_at_idx on app.funnel_log (at);
alter table app.funnel_log enable row level security;

create or replace function app.log_inquiry_funnel() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.is_demo then return null; end if;
  if tg_op = 'INSERT' then
    insert into app.funnel_log (at, event, category, region) values (new.created_at, 'inquiry_submitted', new.category, new.region);
    if new.confirmed_at is not null then
      insert into app.funnel_log (at, event, category, region) values (new.confirmed_at, 'inquiry_confirmed', new.category, new.region);
    end if;
  elsif new.confirmed_at is not null and old.confirmed_at is null then
    insert into app.funnel_log (at, event, category, region) values (new.confirmed_at, 'inquiry_confirmed', new.category, new.region);
  end if;
  return null;
end $$;
drop trigger if exists inquiries_funnel on app.inquiries;
create trigger inquiries_funnel after insert or update of confirmed_at on app.inquiries
  for each row execute function app.log_inquiry_funnel();

create or replace function app.log_contact_funnel() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into app.funnel_log (at, event, category, region)
  select new.viewed_at, 'contact_view', i.category, i.region from app.inquiries i where i.id = new.inquiry_id and not i.is_demo;
  return null;
end $$;
drop trigger if exists contact_views_funnel on app.inquiry_contact_views;
create trigger contact_views_funnel after insert on app.inquiry_contact_views
  for each row execute function app.log_contact_funnel();

-- Doplnění historie z dat, která ještě existují (jen jednou).
do $$ begin
  if not exists (select 1 from app.funnel_log) then
    insert into app.funnel_log (at, event, category, region)
      select created_at, 'inquiry_submitted', category, region from app.inquiries where not is_demo
      union all select confirmed_at, 'inquiry_confirmed', category, region from app.inquiries where not is_demo and confirmed_at is not null
      union all select v.viewed_at, 'contact_view', i.category, i.region from app.inquiry_contact_views v join app.inquiries i on i.id = v.inquiry_id where not i.is_demo;
  end if;
end $$;

/**
 * Konverzní přehled po týdnech (posledních 12): zákazníci (poptávky → potvrzené → zobrazené kontakty)
 * a řemeslníci (registrace → firmy → aktivované = první vystavená nabídka/faktura → platící = první platba).
 */
create or replace function public.admin_funnel() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform app.require_admin();
  with weeks as (
    select w from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w
  ), activated as (
    select company_id, min(coalesce(issued_at, created_at)) as at from public.documents
    where number is not null and type in ('quote', 'invoice', 'invoice_non_payer', 'advance') group by company_id
  ), paying as (
    select company_id, min(created_at) as at from app.billing_payments group by company_id
  ), rows as (
    select w,
      (select count(*) from app.funnel_log where event = 'inquiry_submitted' and at >= w and at < w + interval '7 days') as inquiries,
      (select count(*) from app.funnel_log where event = 'inquiry_confirmed' and at >= w and at < w + interval '7 days') as confirmed,
      (select count(*) from app.funnel_log where event = 'contact_view' and at >= w and at < w + interval '7 days') as contacts,
      (select count(*) from auth.users where created_at >= w and created_at < w + interval '7 days') as signups,
      (select count(*) from public.companies where created_at >= w and created_at < w + interval '7 days') as companies,
      (select count(*) from activated where at >= w and at < w + interval '7 days') as activated,
      (select count(*) from paying where at >= w and at < w + interval '7 days') as paying
    from weeks
  )
  select jsonb_build_object(
    'weekly', coalesce((select jsonb_agg(jsonb_build_object('week', w::date, 'inquiries', inquiries, 'confirmed', confirmed,
                 'contacts', contacts, 'signups', signups, 'companies', companies, 'activated', activated, 'paying', paying) order by w) from rows), '[]'::jsonb),
    'total', jsonb_build_object(
      'inquiries', (select count(*) from app.funnel_log where event = 'inquiry_submitted'),
      'confirmed', (select count(*) from app.funnel_log where event = 'inquiry_confirmed'),
      'contacts', (select count(*) from app.funnel_log where event = 'contact_view'),
      'signups', (select count(*) from auth.users),
      'companies', (select count(*) from public.companies),
      'activated', (select count(*) from activated),
      'paying', (select count(*) from paying)
    )
  ) into r;
  return r;
end $$;

revoke all on function app.log_inquiry_funnel(), app.log_contact_funnel() from public, anon, authenticated;
revoke all on function public.admin_funnel() from public, anon;
grant execute on function public.admin_funnel() to authenticated;
