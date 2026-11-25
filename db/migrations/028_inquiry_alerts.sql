-- iŘemeslo – upozornění řemeslníkům na nové poptávky e-mailem (rozhodnutí č. 6).
-- Komu: firma s IČO ověřeným v ARES, platným předplatným a aspoň jednou profesí; jen poptávky jejích oborů
-- a zvolených krajů (žádný kraj = celá ČR). Jak často: „ihned“ (kontrola každých 10 minut, víc poptávek
-- v jednom e-mailu) nebo „denně“ ráno. Každou poptávku firma dostane nejvýš jednou. Odhlášení jedním odkazem.

create table if not exists public.inquiry_alert_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default true,
  frequency text not null default 'instant' check (frequency in ('instant', 'daily')),
  regions text[] not null default '{}' check (regions <@ array['praha', 'stredocesky', 'jihocesky', 'plzensky', 'karlovarsky',
    'ustecky', 'liberecky', 'kralovehradecky', 'pardubicky', 'vysocina', 'jihomoravsky', 'olomoucky', 'zlinsky', 'moravskoslezsky']),
  unsubscribe_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  updated_at timestamptz not null default now()
);
alter table public.inquiry_alert_settings enable row level security;
-- Čtení a zápis jen přes funkce níže (token k odhlášení nesmí uniknout ostatním členům firmy přes API).

create table if not exists app.inquiry_alerts_sent (
  company_id uuid not null references public.companies(id) on delete cascade,
  inquiry_id uuid not null references app.inquiries(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (company_id, inquiry_id)
);
create index if not exists inquiry_alerts_sent_inquiry_idx on app.inquiry_alerts_sent (inquiry_id);
alter table app.inquiry_alerts_sent enable row level security;

create or replace function app.inquiry_category_label(p text) returns text
language sql immutable as $$
  select case p
    when 'auto' then 'Automobilový průmysl' when 'cisteni' then 'Čištění střech, fasád a dlažeb' when 'elektro' then 'Elektroinstalace'
    when 'fasady' then 'Fasády a zateplení' when 'malovani' then 'Malování a natěračství' when 'obklady' then 'Obklady a dlažby'
    when 'podlahy' then 'Podlahy' when 'renovace' then 'Renovace exteriérů nemovitostí' when 'strechy' then 'Střechy a klempířství'
    when 'tesarske' then 'Tesařské a truhlářské práce' when 'uklid' then 'Úklid' when 'instalace' then 'Voda, topení, plyn'
    when 'zahrada' then 'Zahrada a terénní úpravy' when 'zednicke' then 'Zednické práce a rekonstrukce' else 'Jiné' end
$$;

create or replace function app.region_label(p text) returns text
language sql immutable as $$
  select case p
    when 'praha' then 'Praha' when 'stredocesky' then 'Středočeský kraj' when 'jihocesky' then 'Jihočeský kraj'
    when 'plzensky' then 'Plzeňský kraj' when 'karlovarsky' then 'Karlovarský kraj' when 'ustecky' then 'Ústecký kraj'
    when 'liberecky' then 'Liberecký kraj' when 'kralovehradecky' then 'Královéhradecký kraj' when 'pardubicky' then 'Pardubický kraj'
    when 'vysocina' then 'Kraj Vysočina' when 'jihomoravsky' then 'Jihomoravský kraj' when 'olomoucky' then 'Olomoucký kraj'
    when 'zlinsky' then 'Zlínský kraj' when 'moravskoslezsky' then 'Moravskoslezský kraj' else null end
$$;

/**
 * Odešle upozornění pro danou frekvenci. Vrací počet odeslaných e-mailů.
 * Bere poptávky potvrzené za poslední 3 dny (u „ihned“) nebo 2 dny (u „denně“) – starší už neposíláme.
 */
create or replace function app.process_inquiry_alerts(p_frequency text) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  site text := rtrim(coalesce(app.setting('site_url'), 'https://www.iremeslo.cz'), '/');
  r record;
  sent int := 0;
  items text;
  n int;
  token text;
begin
  for r in
    with cand as (
      select i.id, i.category, i.region, i.title, i.city, i.term, i.term_date, coalesce(i.confirmed_at, i.created_at) as at
      from app.inquiries i
      where i.status = 'open' and not i.is_demo and i.expires_at >= now()
        and coalesce(i.confirmed_at, i.created_at) >= now() - case when p_frequency = 'daily' then interval '2 days' else interval '3 days' end
    ), firms as (
      select c.id as company_id, c.name, coalesce(s.regions, '{}') as regions,
             (select u.email from public.memberships m join auth.users u on u.id = m.user_id
              where m.company_id = c.id and m.role = 'owner' and app.email_verified(u.id) order by m.created_at limit 1) as email
      from public.companies c
      left join public.inquiry_alert_settings s on s.company_id = c.id
      where c.ico_verified_at is not null and not c.read_only and app.subscription_ok(c.id)
        and coalesce(s.enabled, true) and coalesce(s.frequency, 'instant') = p_frequency
    ), matches as (
      select f.company_id, f.name, f.email, x.*
      from firms f
      join cand x on exists (select 1 from public.company_professions cp join public.professions p on p.slug = cp.profession_slug
                              where cp.company_id = f.company_id and p.category = x.category)
                 and (cardinality(f.regions) = 0 or x.region is null or x.region = any (f.regions))
      where f.email is not null
        and not exists (select 1 from app.inquiry_alerts_sent a where a.company_id = f.company_id and a.inquiry_id = x.id)
    )
    select company_id, name, email, array_agg(id order by at desc) as ids, count(*)::int as cnt
    from matches group by company_id, name, email
  loop
    n := least(r.cnt, 15);
    select string_agg(
             '<tr><td style="padding:12px 0;border-top:1px solid #dfe4eb">'
             || '<a href="' || site || '/poptavky/' || i.id || '" style="color:#05264c;font-size:16px;font-weight:700;text-decoration:none">' || app.html_escape(i.title) || '</a>'
             || '<div style="margin-top:4px;font-size:14px;color:#556273">' || app.html_escape(app.inquiry_category_label(i.category)) || ' · ' || app.html_escape(i.city)
             || coalesce(' · ' || app.region_label(i.region), '')
             || case i.term when 'asap' then ' · ihned' when 'month' then ' · do měsíce' when 'quarter' then ' · do 3 měsíců'
                             when 'date' then coalesce(' · od ' || to_char(i.term_date, 'FMDD. FMMM. YYYY'), '') else ' · termín dohodou' end
             || '</div></td></tr>', '' order by coalesce(i.confirmed_at, i.created_at) desc)
      into items
      from app.inquiries i where i.id = any (r.ids[1:n]);

    insert into public.inquiry_alert_settings (company_id) values (r.company_id) on conflict (company_id) do nothing;
    select s.unsubscribe_token into token from public.inquiry_alert_settings s where s.company_id = r.company_id;

    perform app.send_email(r.email,
      case when r.cnt = 1 then 'Nová poptávka ve vašem oboru' else r.cnt || ' nové poptávky ve vašem oboru' end,
      app.email_layout(case when r.cnt = 1 then 'Nová poptávka pro vás' else 'Nové poptávky pro vás' end,
        '<p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#556273">Zákazníci hledají řemeslníka ve vašem oboru. Ozvěte se jako první – kontakt zobrazíte v detailu poptávky.</p>'
        || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">' || items || '</table>'
        || case when r.cnt > n then '<p style="margin:0 0 16px;font-size:14px;color:#556273">… a ' || (r.cnt - n) || ' dalších.</p>' else '' end
        || '<p style="margin:0 0 24px"><a href="' || site || '/poptavky?moje=1" style="display:inline-block;background:#fe820d;color:#05264c;'
        || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Zobrazit poptávky</a></p>'
        || '<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#556273">Upozornění dostáváte jako ' || app.html_escape(r.name)
        || ' podle profesí firmy. <a href="' || site || '/app/nastaveni#upozorneni" style="color:#b4540a">Změnit obory, kraje nebo frekvenci</a> · '
        || '<a href="' || site || '/upozorneni/odhlasit?t=' || token || '" style="color:#b4540a">Odhlásit upozornění</a></p>'),
      'inquiry_alert');

    insert into app.inquiry_alerts_sent (company_id, inquiry_id)
    select r.company_id, unnest(r.ids) on conflict do nothing;
    sent := sent + 1;
  end loop;
  return sent;
end $$;
revoke all on function app.process_inquiry_alerts(text) from public, anon, authenticated;

/** Nastavení upozornění pro stránku Nastavení (s výchozími hodnotami, i když řádek ještě neexistuje). */
create or replace function public.my_alert_settings(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.inquiry_alert_settings%rowtype;
begin
  if not app.is_staff(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  select * into s from public.inquiry_alert_settings where company_id = p_company;
  return jsonb_build_object(
    'enabled', coalesce(s.enabled, true), 'frequency', coalesce(s.frequency, 'instant'), 'regions', to_jsonb(coalesce(s.regions, '{}')),
    'verified', (select c.ico_verified_at is not null from public.companies c where c.id = p_company),
    'professions', (select count(*) from public.company_professions cp where cp.company_id = p_company),
    'sent_30d', (select count(distinct date_trunc('hour', a.sent_at)) from app.inquiry_alerts_sent a where a.company_id = p_company and a.sent_at > now() - interval '30 days'),
    'inquiries_30d', (select count(*) from app.inquiry_alerts_sent a where a.company_id = p_company and a.sent_at > now() - interval '30 days'));
end $$;
revoke all on function public.my_alert_settings(uuid) from public, anon;
grant execute on function public.my_alert_settings(uuid) to authenticated;

create or replace function public.save_alert_settings(p_company uuid, p_enabled boolean, p_frequency text, p_regions text[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.can_write(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  insert into public.inquiry_alert_settings (company_id, enabled, frequency, regions, updated_at)
  values (p_company, p_enabled, p_frequency, coalesce(p_regions, '{}'), now())
  on conflict (company_id) do update set enabled = excluded.enabled, frequency = excluded.frequency, regions = excluded.regions, updated_at = now();
end $$;
revoke all on function public.save_alert_settings(uuid, boolean, text, text[]) from public, anon;
grant execute on function public.save_alert_settings(uuid, boolean, text, text[]) to authenticated;

/** Veřejně: odhlášení upozornění odkazem z e-mailu (bez přihlášení). Vrátí název firmy, nebo null. */
create or replace function public.alerts_unsubscribe(p_token text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare firm text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{36}$' then return null; end if;
  update public.inquiry_alert_settings s set enabled = false, updated_at = now() where s.unsubscribe_token = p_token
  returning (select c.name from public.companies c where c.id = s.company_id) into firm;
  return firm;
end $$;
revoke all on function public.alerts_unsubscribe(text) from public;
grant execute on function public.alerts_unsubscribe(text) to anon, authenticated;

/** Pro zadavatele: kolika firmám jsme poptávku poslali (zobrazí se u poptávky). */
create or replace function app.inquiry_alerted_count(p_inquiry uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from app.inquiry_alerts_sent where inquiry_id = p_inquiry
$$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('iremeslo-inquiry-alerts', '*/10 * * * *', $c$select app.process_inquiry_alerts('instant')$c$);
    perform cron.schedule('iremeslo-inquiry-alerts-daily', '43 5 * * *', $c$select app.process_inquiry_alerts('daily')$c$);
  end if;
end $$;
