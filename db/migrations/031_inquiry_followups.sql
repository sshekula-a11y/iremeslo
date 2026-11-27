-- iŘemeslo – poptávky: ochrana proti spamu bez rizika zablokování všech, e-mail o zveřejnění,
-- připomenutí po 7 a 14 dnech a podklady pro založení zakázky z vybrané nabídky.
--
-- Dřív platil jeden limit 40 poptávek za hodinu pro celý web – jeden robot tak mohl zastavit poptávky všem.
-- Teď se počítá zvlášť za adresu návštěvníka (hlavička cf-connecting-ip, kterou volající nepodvrhne; formulář proto
-- volá databázi přímo z prohlížeče) a za e-mail. Celková pojistka hlídá jen nepotvrzené poptávky. Ukládá se jen otisk.

alter table app.inquiries
  add column if not exists src_hash text,
  add column if not exists published_mail_at timestamptz,
  add column if not exists remind7_at timestamptz,
  add column if not exists remind14_at timestamptz;
create index if not exists inquiries_src_hash_idx on app.inquiries (src_hash, created_at) where src_hash is not null;
create index if not exists inquiries_pending_idx on app.inquiries (created_at) where status = 'pending';

/** Otisk IP adresy volajícího podle hlavičky od Cloudflare (u Supabase ji volající nemůže podvrhnout). Mimo API null. */
create or replace function app.caller_ip_hash() returns text
language sql stable set search_path = public, extensions, pg_temp as $$
  select encode(digest('iremeslo-src:' || ip, 'sha256'), 'hex')
  from (select nullif(coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb) ->> 'cf-connecting-ip', '') as ip) x
  where ip is not null
$$;
revoke all on function app.caller_ip_hash() from public, anon, authenticated;

/** 1 nabídka, 2 nabídky, 5 nabídek. */
create or replace function app.cz_plural(n int, one text, few text, many text) returns text
language sql immutable as $$
  select n || ' ' || case when n = 1 then one when n between 2 and 4 then few else many end
$$;

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
  v_folder text := nullif(p ->> 'photos_folder', '');
  v_src text := app.caller_ip_hash();
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
  if v_folder is not null and v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'neplatné fotky' using errcode = '22023';
  end if;
  if v_folder is not null and exists (select 1 from app.inquiries where photos_folder = v_folder::uuid) then
    raise exception 'fotky už patří jiné poptávce' using errcode = '22023';
  end if;
  -- Limity proti spamu: na adresu návštěvníka (formulář volá databázi přímo z prohlížeče, adresu dodá Cloudflare
  -- a volající ji nepodvrhne) a pojistka na nepotvrzené poptávky. Potvrzené poptávky ostatních nic neblokuje.
  if v_src is not null and ((select count(*) from app.inquiries where src_hash = v_src and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from app.inquiries where src_hash = v_src and created_at > now() - interval '1 day') >= 15) then
    raise exception 'příliš mnoho poptávek z jednoho místa, zkuste to později' using errcode = '53400';
  end if;
  if (select count(*) from app.inquiries where status = 'pending' and created_at > now() - interval '1 hour') >= 300 then
    raise exception 'příliš mnoho poptávek, zkuste to za chvíli' using errcode = '53400';
  end if;
  if (select count(*) from app.inquiries where contact_email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'z tohoto e-mailu bylo dnes zadáno příliš mnoho poptávek' using errcode = '53400';
  end if;

  insert into app.inquiries (category, title, quantity, unit, description, city, zip, region, street, term, term_from, term_date,
                             contact_name, contact_phone, contact_email, token_hash, photos_folder, src_hash)
  values (p ->> 'category', v_title, nullif(p ->> 'quantity', '')::numeric, nullif(p ->> 'unit', ''),
          trim(coalesce(p ->> 'description', '')), trim(coalesce(p ->> 'city', '')), v_zip, v_region,
          nullif(trim(coalesce(p ->> 'street', '')), ''), v_term, case when v_term = 'date' then v_term_from end,
          case when v_term = 'date' then v_term_date end,
          trim(coalesce(p ->> 'contact_name', '')), v_phone, v_email, encode(digest(token, 'sha256'), 'hex'), v_folder::uuid, v_src)
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
revoke all on function public.submit_inquiry(jsonb) from public;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;

create or replace function public.my_offers(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_staff(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'inquiry_id', i.id, 'title', i.title, 'city', i.city, 'category', i.category,
      'quantity', i.quantity, 'unit', i.unit, 'description', i.description, 'term', i.term,
      'inquiry_status', case when i.status = 'open' and i.expires_at < now() then 'expired' else i.status end,
      'price', o.price, 'vat_note', o.vat_note, 'start_date', o.start_date, 'duration', o.duration, 'status', o.status,
      'created_at', o.created_at, 'decided_at', o.decided_at, 'valid_until', o.valid_until,
      'contact', case when o.status = 'accepted' then jsonb_build_object('name', i.contact_name, 'phone', i.contact_phone,
                       'email', i.contact_email, 'street', i.street, 'city', i.city, 'zip', i.zip) end)
      order by o.created_at desc)
    from app.inquiry_offers o join app.inquiries i on i.id = o.inquiry_id
    where o.company_id = p_company and o.status <> 'withdrawn'), '[]'::jsonb);
end $$;
revoke all on function public.my_offers(uuid) from public, anon;
grant execute on function public.my_offers(uuid) to authenticated;

/**
 * E-maily zadavateli po zveřejnění (každých 10 minut, po rozeslání upozornění firmám):
 * 1. „Poptávka je zveřejněná“ s počtem upozorněných firem (asi 15 minut po potvrzení),
 * 2. po 7 dnech: přehled nabídek, nebo rada, co dělat, když žádná nepřišla,
 * 3. po 14 dnech: je poptávka ještě aktuální? Pokud ne, ať ji uzavře.
 * Každý e-mail jen jednou, jen u otevřené poptávky a s novým odkazem na správu poptávky.
 */
create or replace function app.process_inquiry_followups() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  n int := 0;
  firms int;
  offers int;
  link text;
  btn text;
  intro text;
begin
  for r in
    select i.*,
      case when i.published_mail_at is null and i.confirmed_at <= now() - interval '15 minutes' and i.confirmed_at > now() - interval '2 days' then 'published'
           when i.remind7_at is null and i.confirmed_at <= now() - interval '7 days' and i.confirmed_at > now() - interval '13 days' then 'day7'
           when i.remind14_at is null and i.confirmed_at <= now() - interval '14 days' and i.confirmed_at > now() - interval '20 days' then 'day14'
      end as kind
    from app.inquiries i
    where i.status = 'open' and not i.is_demo and i.expires_at > now() and i.confirmed_at is not null
      and (i.published_mail_at is null or i.remind7_at is null or i.remind14_at is null)
    order by i.confirmed_at
    limit 200
  loop
    continue when r.kind is null;
    link := app.inquiry_new_link(r.id);
    btn := '<p style="margin:0 0 24px"><a href="' || link || '" style="display:inline-block;background:#fe820d;color:#05264c;'
      || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">%s</a></p>';
    intro := '<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#556273">Poptávka <strong style="color:#05264c">„'
      || app.html_escape(r.title) || '“</strong> ';
    select count(*)::int into offers from app.inquiry_offers o where o.inquiry_id = r.id and o.status in ('sent', 'accepted');

    if r.kind = 'published' then
      firms := app.inquiry_alerted_count(r.id);
      perform app.send_email(r.contact_email, 'Poptávka je zveřejněná: ' || r.title, app.email_layout('Vaše poptávka je zveřejněná',
        intro || 'je v seznamu poptávek na iRemeslo.cz.</p>'
        || '<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#556273">'
        || case when firms > 0 then 'Upozornění jsme e-mailem poslali <strong style="color:#05264c">' || app.cz_plural(firms, 'firmě', 'firmám', 'firmám')
                                    || '</strong> z vašeho oboru a kraje.'
                else 'Vidí ji řemeslníci, kteří procházejí poptávky, a firmy s upozorněním na váš obor ji dostanou e-mailem.' end
        || ' Váš kontakt uvidí jen firmy s IČO ověřeným v ARES.</p>'
        || '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Nabídky, které přijdou, porovnáte na jednom místě. '
        || 'Až si vyberete, poptávku tamtéž uzavřete.</p>'
        || format(btn, 'Nabídky a správa poptávky')), 'poptavka_info');
      update app.inquiries set published_mail_at = now() where id = r.id;

    elsif r.kind = 'day7' then
      perform app.send_email(r.contact_email,
        case when offers > 0 then 'Máte ' || app.cz_plural(offers, 'nabídku', 'nabídky', 'nabídek') || ': ' || r.title
             else 'Poptávka po týdnu: ' || r.title end,
        app.email_layout(case when offers > 0 then 'Porovnejte nabídky' else 'Jak jde vaše poptávka' end,
          intro || 'je zveřejněná týden.</p>'
          || case when offers > 0 then
               '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Přišlo k ní <strong style="color:#05264c">'
               || app.cz_plural(offers, 'nabídka', 'nabídky', 'nabídek') || '</strong>. Porovnejte cenu, termín a zprávu a vyberte. '
               || 'Vybraná firma dostane váš kontakt, ostatním dáme vědět.</p>'
             else
               '<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#556273">Nabídka přes iRemeslo.cz zatím nepřišla. '
               || 'Řemeslníci se ale ozývají i telefonem nebo e-mailem.</p>'
               || '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Pokud už máte dodavatele, poptávku prosím uzavřete, '
               || 'ať vás další firmy zbytečně nekontaktují.</p>' end
          || format(btn, case when offers > 0 then 'Porovnat nabídky' else 'Spravovat poptávku' end)), 'poptavka_info');
      update app.inquiries set remind7_at = now() where id = r.id;

    else
      perform app.send_email(r.contact_email, 'Je poptávka stále aktuální? ' || r.title, app.email_layout('Je poptávka stále aktuální?',
        intro || 'je zveřejněná 14 dní'
        || case when offers > 0 then ' a má ' || app.cz_plural(offers, 'nabídku', 'nabídky', 'nabídek') else '' end || '.</p>'
        || '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Našli jste řemeslníka? Poptávku uzavřete jedním klepnutím. '
        || 'Jinak zůstane zveřejněná do ' || to_char(r.expires_at, 'FMDD. FMMM. YYYY') || ' a už vám kvůli ní nebudeme psát.</p>'
        || format(btn, case when offers > 0 then 'Vybrat nabídku nebo uzavřít' else 'Uzavřít nebo ponechat' end)), 'poptavka_info');
      update app.inquiries set remind14_at = now() where id = r.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function app.process_inquiry_followups() from public, anon, authenticated;

-- Poptávky potvrzené před nasazením: e-mail o zveřejnění už neposíláme.
update app.inquiries set published_mail_at = coalesce(published_mail_at, now())
where confirmed_at is not null and confirmed_at < now() - interval '1 day';

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('iremeslo-inquiry-followups', '5-59/10 * * * *', 'select app.process_inquiry_followups()');
  end if;
end $$;
