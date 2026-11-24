-- iŘemeslo – termín realizace poptávky: dohodou / ihned / vlastní termín od–do.
-- Formulář nabízí tři volby: 'flexible' (Dohodou), 'asap' (Ihned) a 'date' (vlastní termín). Vlastní termín má
-- nově i datum zahájení (term_from); stačí vyplnit jedno z dat. Hodnoty 'month' a 'quarter' zůstávají platné
-- pro dříve zadané poptávky.

alter table app.inquiries add column if not exists term_from date;
alter table app.inquiries drop constraint if exists inquiries_term_range;
alter table app.inquiries add constraint inquiries_term_range check (term_from is null or term_date is null or term_date >= term_from);

create or replace function app.inquiry_public(i app.inquiries) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', i.id, 'created_at', coalesce(i.confirmed_at, i.created_at), 'status',
    case when i.status = 'open' and i.expires_at < now() then 'expired' else i.status end,
    'category', i.category, 'title', i.title, 'quantity', i.quantity, 'unit', i.unit,
    'description', i.description, 'city', i.city, 'zip', i.zip, 'term', i.term, 'term_from', i.term_from, 'term_date', i.term_date,
    'expires_at', i.expires_at,
    'views', (select count(*) from app.inquiry_contact_views v where v.inquiry_id = i.id)
  )
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

  insert into app.inquiries (category, title, quantity, unit, description, city, zip, street, term, term_from, term_date,
                             contact_name, contact_phone, contact_email, token_hash)
  values (p ->> 'category', v_title, nullif(p ->> 'quantity', '')::numeric, nullif(p ->> 'unit', ''),
          trim(coalesce(p ->> 'description', '')), trim(coalesce(p ->> 'city', '')), v_zip,
          nullif(trim(coalesce(p ->> 'street', '')), ''), v_term, case when v_term = 'date' then v_term_from end,
          case when v_term = 'date' then v_term_date end,
          trim(coalesce(p ->> 'contact_name', '')), v_phone, v_email, encode(digest(token, 'sha256'), 'hex'))
  returning id into new_id;

  link := rtrim(app.setting('site_url'), '/') || '/poptavky/sprava?t=' || token;
  sent := app.send_email(v_email, 'Potvrďte svou poptávku na iRemeslo.cz', app.email_layout('Potvrďte svou poptávku',
    '<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#556273">Děkujeme za zadání poptávky '
    || '<strong style="color:#05264c">„' || app.html_escape(v_title) || '“</strong>.</p>'
    || '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Poptávku zveřejníme, jakmile ji potvrdíte. '
    || 'Ozvou se vám řemeslníci registrovaní na iRemeslo.cz.</p>'
    || '<p style="margin:0 0 24px"><a href="' || link || '" style="display:inline-block;background:#fe820d;color:#05264c;'
    || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Potvrdit a zveřejnit poptávku</a></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Stejným odkazem poptávku později uzavřete, '
    || 'až najdete dodavatele. E-mail si proto uschovejte.<br>Tlačítko nefunguje? Zkopírujte tento odkaz do prohlížeče:<br>'
    || '<span style="word-break:break-all;color:#b4540a">' || link || '</span></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Pokud jste poptávku nezadali, e-mail ignorujte – '
    || 'nepotvrzenou poptávku do 3 dnů smažeme.</p>'), 'poptavka');
  return jsonb_build_object('id', new_id, 'email_sent', sent);
end $$;

revoke all on function app.inquiry_public(app.inquiries) from public, anon, authenticated;
revoke all on function public.submit_inquiry(jsonb) from public;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;
