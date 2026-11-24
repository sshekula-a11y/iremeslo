-- iŘemeslo – veřejné poptávky.
--
-- Kdokoli (i bez registrace) zadá poptávku: co, kategorie, rozsah, popis, obec, termín a kontakt.
--  * Poptávka se zveřejní až po potvrzení odkazem z e-mailu (ochrana proti spamu a ověření kontaktu).
--    Stejný odkaz slouží zadavateli ke správě (uzavření). Ukládá se jen sha256 tokenu.
--  * Veřejně je vidět popis, obec, PSČ a termín. Jméno, telefon, e-mail a ulici vidí jen přihlášený
--    uživatel s potvrzeným e-mailem, a to po kliknutí; každé zobrazení se zapíše (max. 50 kontaktů denně).
--  * Tabulky jsou ve schématu app bez práv pro anon/authenticated – vše jde přes funkce níže.
--  * Platnost 60 dní. Nepotvrzené poptávky se mažou po 3 dnech, uzavřené a prošlé 90 dní po skončení.

create table if not exists app.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'open', 'closed', 'hidden')),
  category text not null check (category in ('malovani', 'fasady', 'strechy', 'podlahy', 'obklady', 'zednicke',
                                              'instalace', 'elektro', 'tesarske', 'zahrada', 'uklid', 'jine')),
  title text not null check (length(title) between 5 and 120),
  quantity numeric(12, 2) check (quantity is null or quantity > 0),
  unit text check (unit in ('m2', 'bm', 'ks', 'hod', 'pausal')),
  description text not null check (length(description) between 20 and 3000),
  city text not null check (length(city) between 2 and 100),
  zip text check (zip ~ '^[0-9]{3} ?[0-9]{2}$'),
  street text check (length(street) <= 200),
  term text not null check (term in ('asap', 'month', 'quarter', 'flexible', 'date')),
  term_date date,
  contact_name text not null check (length(contact_name) between 2 and 100),
  contact_phone text check (contact_phone ~ '^\+?[0-9 ]{9,20}$'),
  contact_email text not null check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '60 days',
  closed_at timestamptz
);
create index if not exists inquiries_open_idx on app.inquiries (status, created_at desc);

create table if not exists app.inquiry_contact_views (
  inquiry_id uuid not null references app.inquiries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (inquiry_id, user_id)
);
create index if not exists inquiry_contact_views_user_idx on app.inquiry_contact_views (user_id, viewed_at desc);

alter table app.inquiries enable row level security;
alter table app.inquiry_contact_views enable row level security;
comment on table app.inquiries is 'Veřejné poptávky. Kontakt a ulici vydává jen funkce inquiry_contact přihlášeným s potvrzeným e-mailem.';

-- ---------------------------------------------------------------------------
-- Pomocné
-- ---------------------------------------------------------------------------

create or replace function app.html_escape(p text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

/** Veřejná podoba poptávky (bez kontaktu a ulice). */
create or replace function app.inquiry_public(i app.inquiries) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', i.id, 'created_at', coalesce(i.confirmed_at, i.created_at), 'status',
    case when i.status = 'open' and i.expires_at < now() then 'expired' else i.status end,
    'category', i.category, 'title', i.title, 'quantity', i.quantity, 'unit', i.unit,
    'description', i.description, 'city', i.city, 'zip', i.zip, 'term', i.term, 'term_date', i.term_date,
    'expires_at', i.expires_at,
    'views', (select count(*) from app.inquiry_contact_views v where v.inquiry_id = i.id)
  )
$$;

-- ---------------------------------------------------------------------------
-- Zadání a správa poptávky (bez přihlášení)
-- ---------------------------------------------------------------------------

create or replace function public.submit_inquiry(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_email text := lower(trim(coalesce(p ->> 'contact_email', '')));
  v_title text := trim(coalesce(p ->> 'title', ''));
  v_term text := coalesce(nullif(p ->> 'term', ''), 'flexible');
  v_term_date date := nullif(p ->> 'term_date', '')::date;
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
  if v_term = 'date' and (v_term_date is null or v_term_date < current_date) then
    raise exception 'zadejte termín v budoucnosti' using errcode = '22023';
  end if;
  if (select count(*) from app.inquiries where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'příliš mnoho poptávek, zkuste to za chvíli' using errcode = '53400';
  end if;
  if (select count(*) from app.inquiries where contact_email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'z tohoto e-mailu bylo dnes zadáno příliš mnoho poptávek' using errcode = '53400';
  end if;

  insert into app.inquiries (category, title, quantity, unit, description, city, zip, street, term, term_date,
                             contact_name, contact_phone, contact_email, token_hash)
  values (p ->> 'category', v_title, nullif(p ->> 'quantity', '')::numeric, nullif(p ->> 'unit', ''),
          trim(coalesce(p ->> 'description', '')), trim(coalesce(p ->> 'city', '')), v_zip,
          nullif(trim(coalesce(p ->> 'street', '')), ''), v_term, case when v_term = 'date' then v_term_date end,
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

/** Odkaz z e-mailu: první otevření poptávku zveřejní, další slouží ke správě. */
create or replace function public.confirm_inquiry(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  i app.inquiries%rowtype;
  first_confirm boolean := false;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false); end if;
  select * into i from app.inquiries where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('ok', false); end if;
  if i.status = 'pending' then
    if i.created_at < now() - interval '3 days' then return jsonb_build_object('ok', false); end if;
    update app.inquiries set status = 'open', confirmed_at = now(), expires_at = now() + interval '60 days'
    where id = i.id returning * into i;
    first_confirm := true;
  end if;
  return jsonb_build_object('ok', true, 'just_confirmed', first_confirm, 'inquiry', app.inquiry_public(i));
end $$;

create or replace function public.close_inquiry(p_token text) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then return false; end if;
  update app.inquiries set status = 'closed', closed_at = now()
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') and status = 'open';
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- Čtení (veřejné)
-- ---------------------------------------------------------------------------

create or replace function public.list_inquiries(p_category text default null, p_city text default null,
                                                 p_limit int default 20, p_offset int default 0) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with f as (
    select * from app.inquiries i
    where i.status = 'open' and i.expires_at >= now()
      and (coalesce(p_category, '') = '' or i.category = p_category)
      and (coalesce(trim(p_city), '') = '' or i.city ilike '%' || replace(replace(trim(p_city), '%', ''), '_', '') || '%'
           or i.zip like replace(replace(trim(p_city), ' ', ''), '%', '') || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'items', coalesce((select jsonb_agg(app.inquiry_public(x) order by coalesce(x.confirmed_at, x.created_at) desc)
                       from (select * from f order by coalesce(confirmed_at, created_at) desc
                             limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)
  )
$$;

/** Detail poptávky bez kontaktu. Nepotvrzené a skryté nejsou vidět. */
create or replace function public.get_inquiry(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select app.inquiry_public(i) from app.inquiries i where i.id = p_id and i.status in ('open', 'closed')
$$;

/** Kontakt na zadavatele: jen přihlášený uživatel s potvrzeným e-mailem, nejvýše 50 nových kontaktů denně. */
create or replace function public.inquiry_contact(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  i app.inquiries%rowtype;
begin
  if uid is null then raise exception 'kontakt vidí jen přihlášení řemeslníci' using errcode = '42501'; end if;
  if not app.email_verified(uid) then raise exception 'nejprve potvrďte svůj e-mail' using errcode = '42501'; end if;
  select * into i from app.inquiries where id = p_id and status = 'open' and expires_at >= now();
  if not found then raise exception 'poptávka už není aktivní' using errcode = 'P0002'; end if;
  if not exists (select 1 from app.inquiry_contact_views where inquiry_id = p_id and user_id = uid) then
    if (select count(*) from app.inquiry_contact_views where user_id = uid and viewed_at > now() - interval '1 day') >= 50 then
      raise exception 'dnes jste zobrazili už 50 kontaktů, zkuste to zítra' using errcode = '53400';
    end if;
    insert into app.inquiry_contact_views (inquiry_id, user_id) values (p_id, uid);
  end if;
  return jsonb_build_object('name', i.contact_name, 'phone', i.contact_phone, 'email', i.contact_email,
                            'street', i.street, 'city', i.city, 'zip', i.zip);
end $$;

-- ---------------------------------------------------------------------------
-- Administrace /ssh → Poptávky
-- ---------------------------------------------------------------------------

create or replace function public.admin_inquiries() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform app.require_admin();
  select coalesce(jsonb_agg(app.inquiry_public(i) || jsonb_build_object('raw_status', i.status, 'contact_name', i.contact_name,
           'contact_email', i.contact_email, 'contact_phone', i.contact_phone) order by i.created_at desc), '[]'::jsonb)
  into r from (select * from app.inquiries order by created_at desc limit 200) i;
  return r;
end $$;

create or replace function public.admin_set_inquiry_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  if p_status not in ('open', 'closed', 'hidden') then raise exception 'neplatný stav'; end if;
  update app.inquiries set status = p_status,
    confirmed_at = case when p_status = 'open' then coalesce(confirmed_at, now()) else confirmed_at end,
    expires_at = case when p_status = 'open' and status = 'pending' then now() + interval '60 days' else expires_at end,
    closed_at = case when p_status <> 'open' then coalesce(closed_at, now()) else null end
  where id = p_id;
  perform app.log_admin('inquiry_' || p_status, null, null, jsonb_build_object('inquiry', p_id));
end $$;

-- ---------------------------------------------------------------------------
-- Úklid (osobní údaje zadavatelů nedržíme déle, než je potřeba)
-- ---------------------------------------------------------------------------

create or replace function app.cleanup_inquiries() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  delete from app.inquiries
  where (status = 'pending' and created_at < now() - interval '3 days')
     or (status in ('closed', 'hidden') and coalesce(closed_at, created_at) < now() - interval '90 days')
     or (status = 'open' and expires_at < now() - interval '90 days');
  get diagnostics n = row_count;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('iremeslo-cleanup-inquiries', '27 3 * * *', 'select app.cleanup_inquiries()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Klíč Resend: odmítnout useknutý klíč (celý má kolem 36 znaků)
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_email_settings(p_api_key text, p_site_url text, p_mail_from text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  secret_id uuid;
  v_key text := nullif(trim(coalesce(p_api_key, '')), '');
begin
  perform app.require_admin();
  if v_key is not null then
    if v_key !~ '^re_[A-Za-z0-9_]{25,}$' then
      raise exception 'klíč Resend je neúplný – začíná „re_“ a má kolem 36 znaků; vytvořte nový a zkopírujte ho celý' using errcode = '22023';
    end if;
    select id into secret_id from vault.secrets where name = 'resend_api_key';
    if secret_id is null then
      perform vault.create_secret(v_key, 'resend_api_key', 'Resend API klíč pro e-maily iRemeslo.cz');
    else
      perform vault.update_secret(secret_id, v_key);
    end if;
  end if;
  if p_site_url is not null then
    if trim(p_site_url) !~ '^https://[a-z0-9.-]+(:[0-9]+)?/?$' then raise exception 'adresa webu musí začínat https://' using errcode = '22023'; end if;
    update app.settings set value = rtrim(trim(p_site_url), '/'), updated_at = now() where key = 'site_url';
  end if;
  if p_mail_from is not null then
    if trim(p_mail_from) !~ '@' then raise exception 'odesílatel musí obsahovat e-mail' using errcode = '22023'; end if;
    update app.settings set value = trim(p_mail_from), updated_at = now() where key = 'mail_from';
  end if;
  perform app.log_admin('email_settings', null, null, jsonb_build_object('key_changed', v_key is not null, 'site_url', p_site_url, 'mail_from', p_mail_from));
end $$;

-- ---------------------------------------------------------------------------
-- Práva
-- ---------------------------------------------------------------------------

revoke all on function app.html_escape(text), app.inquiry_public(app.inquiries), app.cleanup_inquiries()
  from public, anon, authenticated;
revoke all on function public.submit_inquiry(jsonb), public.confirm_inquiry(text), public.close_inquiry(text),
  public.list_inquiries(text, text, int, int), public.get_inquiry(uuid), public.inquiry_contact(uuid),
  public.admin_inquiries(), public.admin_set_inquiry_status(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_inquiry(jsonb), public.confirm_inquiry(text), public.close_inquiry(text),
  public.list_inquiries(text, text, int, int), public.get_inquiry(uuid) to anon, authenticated;
grant execute on function public.inquiry_contact(uuid), public.admin_inquiries(), public.admin_set_inquiry_status(uuid, text)
  to authenticated;
revoke all on function public.admin_set_email_settings(text, text, text) from public, anon;
grant execute on function public.admin_set_email_settings(text, text, text) to authenticated;
