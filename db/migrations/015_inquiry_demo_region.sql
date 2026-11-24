-- iŘemeslo – ukázkové poptávky odděleně od skutečných, kraj a stáří ve filtrech.
--
--  * app.inquiries.is_demo: ukázky se nikdy nepočítají do čísel a v seznamu jsou ve vlastním bloku;
--    jakmile je aspoň 5 skutečných aktivních poptávek, ukázky se přestanou zobrazovat,
--  * app.inquiries.region: kraj (zadavatel ho vybírá, web ho předvyplní podle PSČ),
--  * list_inquiries: filtry obor, kraj, obec/PSČ a stáří (1, 7, 30 dní).

alter table app.inquiries add column if not exists is_demo boolean not null default false;
alter table app.inquiries add column if not exists region text;
alter table app.inquiries drop constraint if exists inquiries_region_check;
alter table app.inquiries add constraint inquiries_region_check check (region is null or region in (
  'praha', 'stredocesky', 'jihocesky', 'plzensky', 'karlovarsky', 'ustecky', 'liberecky', 'kralovehradecky',
  'pardubicky', 'vysocina', 'jihomoravsky', 'olomoucky', 'zlinsky', 'moravskoslezsky'));

/** Kraj podle PSČ (první tři číslice). Přibližné – slouží jen jako výchozí hodnota, zadavatel ji může změnit. */
create or replace function app.region_from_zip(p_zip text) returns text
language sql immutable set search_path = pg_temp as $$
  select case
    when z is null then null
    when z between 100 and 199 then 'praha'
    when z between 250 and 299 then 'stredocesky'
    when z between 300 and 349 then 'plzensky'
    when z between 350 and 364 then 'karlovarsky'
    when z between 393 and 396 then 'vysocina'
    when z between 370 and 399 then 'jihocesky'
    when z between 400 and 449 then 'ustecky'
    when z between 460 and 479 or z between 511 and 514 then 'liberecky'
    when z between 500 and 519 or z between 540 and 552 then 'kralovehradecky'
    when z between 530 and 539 or z between 560 and 572 then 'pardubicky'
    when z between 580 and 595 or z between 674 and 676 then 'vysocina'
    when z between 686 and 689 or z between 755 and 769 then 'zlinsky'
    when z between 600 and 699 then 'jihomoravsky'
    when z between 790 and 790 or z between 750 and 754 or z between 770 and 789 or z between 796 and 799 then 'olomoucky'
    when z between 700 and 749 or z between 791 and 795 then 'moravskoslezsky'
  end
  from (select nullif(left(regexp_replace(coalesce(p_zip, ''), '\D', '', 'g'), 3), '')::int as z) x
$$;

-- Ukázkové poptávky (vložené při spuštění poptávek) označit a nechat je platit, dokud je skutečné nenahradí.
update app.inquiries set is_demo = true, expires_at = greatest(expires_at, now() + interval '1 year')
where contact_email = 'info@iremeslo.cz' and contact_name = 'iRemeslo.cz (ukázková poptávka)';
update app.inquiries set region = app.region_from_zip(zip) where region is null;

create or replace function app.inquiry_public(i app.inquiries) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', i.id, 'created_at', coalesce(i.confirmed_at, i.created_at), 'status',
    case when i.status = 'open' and i.expires_at < now() then 'expired' else i.status end,
    'category', i.category, 'title', i.title, 'quantity', i.quantity, 'unit', i.unit,
    'description', i.description, 'city', i.city, 'zip', i.zip, 'region', i.region,
    'term', i.term, 'term_from', i.term_from, 'term_date', i.term_date,
    'expires_at', i.expires_at, 'is_demo', i.is_demo,
    'views', (select count(*) from app.inquiry_contact_views v where v.inquiry_id = i.id)
  )
$$;

drop function if exists public.list_inquiries(text, text, int, int);
/**
 * Veřejný seznam aktivních skutečných poptávek s filtry. Ukázky jsou zvlášť v „demo“
 * a vrací se jen, dokud je skutečných aktivních poptávek méně než 5.
 */
create or replace function public.list_inquiries(p_category text default null, p_city text default null,
                                                 p_limit int default 20, p_offset int default 0,
                                                 p_region text default null, p_days int default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with live as (
    select * from app.inquiries i where i.status = 'open' and i.expires_at >= now()
  ), f as (
    select * from live i
    where not i.is_demo
      and (coalesce(p_category, '') = '' or i.category = p_category)
      and (coalesce(p_region, '') = '' or i.region = p_region)
      and (p_days is null or coalesce(i.confirmed_at, i.created_at) >= now() - make_interval(days => least(greatest(p_days, 1), 365)))
      and (coalesce(trim(p_city), '') = '' or i.city ilike '%' || replace(replace(trim(p_city), '%', ''), '_', '') || '%'
           or i.zip like replace(replace(trim(p_city), ' ', ''), '%', '') || '%'
           or replace(i.zip, ' ', '') like replace(replace(trim(p_city), ' ', ''), '%', '') || '%')
  ), real_count as (
    select count(*) as n from live where not is_demo
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'real_total', (select n from real_count),
    'items', coalesce((select jsonb_agg(app.inquiry_public(x) order by coalesce(x.confirmed_at, x.created_at) desc)
                       from (select * from f order by coalesce(confirmed_at, created_at) desc
                             limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb),
    'demo', case when (select n from real_count) >= 5 then '[]'::jsonb else
      coalesce((select jsonb_agg(app.inquiry_public(x) order by x.created_at desc)
                from (select * from live where is_demo order by created_at desc
                      limit least(greatest(coalesce(p_limit, 20), 1), 50)) x), '[]'::jsonb) end
  )
$$;

/** Detail: ukázka je vidět jen, dokud se ukázky zobrazují v seznamu. */
create or replace function public.get_inquiry(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select app.inquiry_public(i) from app.inquiries i
  where i.id = p_id and i.status in ('open', 'closed')
    and (not i.is_demo or (select count(*) from app.inquiries r where not r.is_demo and r.status = 'open' and r.expires_at >= now()) < 5)
$$;

-- Zadání poptávky: navíc kraj (když chybí, odvodí se z PSČ). Zbytek beze změny proti 013.
create or replace function public.submit_inquiry(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_email text := lower(trim(coalesce(p ->> 'contact_email', '')));
  v_title text := trim(coalesce(p ->> 'title', ''));
  v_term text := coalesce(nullif(p ->> 'term', ''), 'flexible');
  v_term_date date := nullif(p ->> 'term_date', '')::date;
  v_term_from date := nullif(p ->> 'term_from', '')::date;
  v_phone text := nullif(regexp_replace(trim(coalesce(p ->> 'contact_phone', '')), '\s+', ' ', 'g'), '');
  v_zip text := nullif(trim(coalesce(p ->> 'zip', '')), '');
  v_region text := coalesce(nullif(p ->> 'region', ''), app.region_from_zip(nullif(trim(coalesce(p ->> 'zip', '')), '')));
  token text := encode(gen_random_bytes(32), 'hex');
  new_id uuid;
  link text;
  sent boolean;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'neplatný e-mail' using errcode = '22023';
  end if;
  if v_term = 'date' then
    if v_term_from is null and v_term_date is null then
      raise exception 'zadejte datum zahájení nebo dokončení' using errcode = '22023';
    end if;
    if coalesce(v_term_from, current_date) < current_date or coalesce(v_term_date, current_date) < current_date then
      raise exception 'zadejte termín v budoucnosti' using errcode = '22023';
    end if;
    if v_term_from is not null and v_term_date is not null and v_term_date < v_term_from then
      raise exception 'dokončení nesmí být před zahájením' using errcode = '22023';
    end if;
  end if;
  if (select count(*) from app.inquiries where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'příliš mnoho poptávek, zkuste to za chvíli' using errcode = '53400';
  end if;
  if (select count(*) from app.inquiries where contact_email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'z tohoto e-mailu bylo dnes zadáno příliš mnoho poptávek' using errcode = '53400';
  end if;

  insert into app.inquiries (category, title, quantity, unit, description, city, zip, region, street, term, term_from, term_date,
                             contact_name, contact_phone, contact_email, token_hash)
  values (p ->> 'category', v_title, nullif(p ->> 'quantity', '')::numeric, nullif(p ->> 'unit', ''),
          trim(coalesce(p ->> 'description', '')), trim(coalesce(p ->> 'city', '')), v_zip, v_region,
          nullif(trim(coalesce(p ->> 'street', '')), ''), v_term, case when v_term = 'date' then v_term_from end,
          case when v_term = 'date' then v_term_date end,
          trim(coalesce(p ->> 'contact_name', '')), v_phone, v_email, encode(digest(token, 'sha256'), 'hex'))
  returning id into new_id;

  link := rtrim(app.setting('site_url'), '/') || '/poptavky/sprava?t=' || token;
  sent := app.send_email(v_email, 'Potvrďte svou poptávku na iRemeslo.cz', app.email_layout('Potvrďte svou poptávku',
    '<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#556273">Děkujeme za zadání poptávky '
    || '<strong style="color:#05264c">„' || app.html_escape(v_title) || '“</strong>.</p>'
    || '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Poptávku zveřejníme, jakmile ji potvrdíte. '
    || 'Ozvou se vám řemeslníci s IČO ověřeným v ARES.</p>'
    || '<p style="margin:0 0 24px"><a href="' || link || '" style="display:inline-block;background:#fe820d;color:#05264c;'
    || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Potvrdit a zveřejnit poptávku</a></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Stejným odkazem poptávku později uzavřete, '
    || 'až najdete dodavatele. E-mail si proto uschovejte.<br>Tlačítko nefunguje? Zkopírujte tento odkaz do prohlížeče:<br>'
    || '<span style="word-break:break-all;color:#b4540a">' || link || '</span></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Pokud jste poptávku nezadali, e-mail ignorujte – '
    || 'nepotvrzenou poptávku do 3 dnů smažeme.</p>'), 'poptavka');
  return jsonb_build_object('id', new_id, 'email_sent', sent);
end $$;

-- Ukázky se nemažou úklidem (platnost se jim prodlužuje výše); skutečné beze změny.
create or replace function app.cleanup_inquiries() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  delete from app.inquiries
  where not is_demo and (
        (status = 'pending' and created_at < now() - interval '3 days')
     or (status in ('closed', 'hidden') and coalesce(closed_at, created_at) < now() - interval '90 days')
     or (status = 'open' and expires_at < now() - interval '90 days'));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function app.inquiry_public(app.inquiries), app.region_from_zip(text) from public, anon, authenticated;
revoke all on function public.list_inquiries(text, text, int, int, text, int), public.get_inquiry(uuid) from public;
grant execute on function public.list_inquiries(text, text, int, int, text, int), public.get_inquiry(uuid) to anon, authenticated;
revoke all on function public.submit_inquiry(jsonb) from public;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;
