-- iŘemeslo – vlastní potvrzení e-mailu (odesílá Resend z info@iremeslo.cz).
--
-- Jak to funguje:
--  * Registrace zůstává okamžitá (008). Nový účet se zapíše do app.unverified_users
--    a databáze mu pošle e-mail s odkazem https://iremeslo.cz/overeni?t=…
--  * Dokud e-mail není potvrzený, jde používat aplikaci (zakázky, nabídky), ale NE vystavit
--    fakturu ani zálohu – faktura s cizím e-mailem by byla k ničemu a zneužitelná.
--  * Účty, které už existovaly před touto migrací, v app.unverified_users nejsou = potvrzené.
--  * Nepotvrzené účty bez firmy se po 7 dnech smažou (pg_cron, každou noc).
--  * Klíč k Resend je jen v trezoru Supabase Vault (vault.secrets), zadává ho provozovatel
--    v administraci /ssh → E-maily. V kódu ani v proměnných prostředí není.
--  * E-mail odchází přes pg_net (HTTP z databáze) až po potvrzení transakce.

do $$ begin
  -- V Supabase pg_net zapneme; lokálně (testy) ho nahrazuje stub ze 000_supabase_stub.sql.
  if not exists (select 1 from pg_namespace where nspname = 'net') then
    create extension if not exists pg_net;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tabulky
-- ---------------------------------------------------------------------------

create table if not exists app.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into app.settings (key, value) values
  ('site_url', 'https://iremeslo.cz'),
  ('mail_from', 'iRemeslo.cz <info@iremeslo.cz>')
on conflict (key) do nothing;

create table if not exists app.unverified_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists app.email_verifications (
  token_hash text primary key,              -- sha256 tokenu; samotný token je jen v e-mailu
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  used_at timestamptz
);
create index if not exists email_verifications_user_idx on app.email_verifications (user_id, created_at desc);

create table if not exists app.email_log (
  id bigint generated always as identity primary key,
  to_email text not null,
  kind text not null,
  request_id bigint,                        -- net._http_response.id (odpověď Resend)
  error text,
  created_at timestamptz not null default now()
);
create index if not exists email_log_created_idx on app.email_log (created_at desc);

alter table app.settings enable row level security;
alter table app.unverified_users enable row level security;
alter table app.email_verifications enable row level security;
alter table app.email_log enable row level security;
comment on table app.unverified_users is 'Účty s nepotvrzeným e-mailem. Kdo tu není, má e-mail potvrzený.';
comment on table app.email_verifications is 'Odkazy pro potvrzení e-mailu. Ukládá se jen hash tokenu.';

-- ---------------------------------------------------------------------------
-- Odesílání
-- ---------------------------------------------------------------------------

create or replace function app.setting(p_key text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select value from app.settings where key = p_key
$$;

create or replace function app.email_verified(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_user is not null and not exists (select 1 from app.unverified_users where user_id = p_user)
$$;

/** Pošle e-mail přes Resend. Bez klíče v trezoru jen zapíše do logu a vrátí false. */
create or replace function app.send_email(p_to text, p_subject text, p_html text, p_kind text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  api_key text;
  req bigint;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if coalesce(api_key, '') = '' then
    insert into app.email_log (to_email, kind, error) values (p_to, p_kind, 'chybí klíč Resend (administrace → E-maily)');
    return false;
  end if;
  req := net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', app.setting('mail_from'), 'to', jsonb_build_array(p_to),
                               'subject', p_subject, 'html', p_html),
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  insert into app.email_log (to_email, kind, request_id) values (p_to, p_kind, req);
  return true;
exception when others then
  insert into app.email_log (to_email, kind, error) values (p_to, p_kind, left(sqlerrm, 300));
  return false;
end $$;

/** Obal e-mailu v barvách iRemeslo.cz s logem. */
create or replace function app.email_layout(p_title text, p_body_html text) returns text
language sql immutable as $$
  select '<div style="margin:0;padding:24px 12px;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#05264c">'
    || '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dfe4eb;border-radius:16px;overflow:hidden">'
    || '<div style="height:6px;background:#fe820d"></div>'
    || '<div style="padding:28px 28px 8px">'
    || '<p style="margin:0 0 20px"><img src="https://iremeslo.cz/brand/logo-bez-sloganu.png" width="180" alt="iRemeslo.cz" '
    || 'style="display:block;width:180px;height:auto;border:0;font-size:22px;font-weight:800;color:#05264c"></p>'
    || '<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">' || p_title || '</h1>'
    || p_body_html
    || '</div>'
    || '<div style="padding:16px 28px 24px;font-size:13px;line-height:1.5;color:#556273;border-top:1px solid #dfe4eb">'
    || 'iRemeslo.cz – nabídky, zakázky a faktury pro řemeslníky.<br>'
    || 'Dotazy: <a href="mailto:info@iremeslo.cz" style="color:#b4540a">info@iremeslo.cz</a>'
    || '</div></div></div>'
$$;

/** Vytvoří odkaz pro potvrzení e-mailu a pošle ho. Odkaz vede vždy na adresu z nastavení, nikdy podle požadavku. */
create or replace function app.start_verification(p_user uuid, p_email text) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  token text := encode(gen_random_bytes(32), 'hex');
  link text := rtrim(app.setting('site_url'), '/') || '/overeni?t=' || token;
begin
  insert into app.email_verifications (token_hash, user_id, email)
  values (encode(digest(token, 'sha256'), 'hex'), p_user, p_email);
  return app.send_email(p_email, 'Potvrďte svůj e-mail na iRemeslo.cz', app.email_layout('Potvrďte svůj e-mail',
    '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Děkujeme za registraci na platformě iRemeslo.cz. '
    || 'Kliknutím potvrdíte, že tento e-mail patří vám. Pak můžete vystavovat faktury.</p>'
    || '<p style="margin:0 0 24px"><a href="' || link || '" style="display:inline-block;background:#fe820d;color:#05264c;'
    || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Potvrdit e-mail</a></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Tlačítko nefunguje? Zkopírujte tento odkaz do prohlížeče:<br>'
    || '<span style="word-break:break-all;color:#b4540a">' || link || '</span></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Odkaz platí 48 hodin. '
    || 'Pokud jste se na iRemeslo.cz neregistrovali, e-mail ignorujte – nepotvrzený účet bez firmy smažeme do 7 dnů.</p>'),
    'overeni');
end $$;

-- ---------------------------------------------------------------------------
-- Registrace: po založení účtu rovnou pošle potvrzovací e-mail
-- ---------------------------------------------------------------------------

create or replace function public.signup_with_password(p_email text, p_password text) returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  uid uuid := gen_random_uuid();
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'neplatný e-mail' using errcode = '22023';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'heslo musí mít aspoň 8 znaků' using errcode = '22023';
  end if;
  if octet_length(p_password) > 72 then
    raise exception 'heslo je příliš dlouhé (nejvýš 72 znaků)' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'e-mail už je registrovaný' using errcode = '23505';
  end if;
  if (select count(*) from auth.users where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'příliš mnoho registrací, zkuste to za chvíli' using errcode = '53400';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf', 10)), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb, '{"signup": "iremeslo"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());

  insert into app.unverified_users (user_id, email) values (uid, v_email);
  perform app.start_verification(uid, v_email);
  return uid;
end $$;

-- ---------------------------------------------------------------------------
-- Pro aplikaci
-- ---------------------------------------------------------------------------

create or replace function public.my_email_status() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'verified', app.email_verified(auth.uid()),
    'email', (select email from auth.users where id = auth.uid()),
    'last_sent_at', (select max(created_at) from app.email_verifications where user_id = auth.uid())
  )
  where auth.uid() is not null
$$;

create or replace function public.resend_verification() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_email text;
  last_at timestamptz;
begin
  if uid is null then raise exception 'nejste přihlášení' using errcode = '42501'; end if;
  if app.email_verified(uid) then return jsonb_build_object('already', true); end if;
  select email into v_email from auth.users where id = uid;
  select max(created_at) into last_at from app.email_verifications where user_id = uid;
  if last_at > now() - interval '2 minutes' then
    raise exception 'e-mail jsme poslali před chvílí, zkuste to za 2 minuty' using errcode = '53400';
  end if;
  if (select count(*) from app.email_verifications where user_id = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'dnes už jsme poslali 5 e-mailů, zkuste to zítra nebo napište na info@iremeslo.cz' using errcode = '53400';
  end if;
  update app.unverified_users set email = v_email where user_id = uid;
  return jsonb_build_object('sent', app.start_verification(uid, v_email), 'email', v_email);
end $$;

/** Odkaz z e-mailu. Funguje i bez přihlášení (otevře se třeba v telefonu). Token má 256 bitů. */
create or replace function public.confirm_email(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v app.email_verifications%rowtype;
  current_email text;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into v from app.email_verifications where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if app.email_verified(v.user_id) then return jsonb_build_object('ok', true, 'already', true); end if;
  if v.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select email into current_email from auth.users where id = v.user_id;
  if lower(current_email) is distinct from lower(v.email) then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;

  update app.email_verifications set used_at = now() where token_hash = v.token_hash;
  delete from app.unverified_users where user_id = v.user_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Faktury a zálohy jen s potvrzeným e-mailem (nabídky a DDPP jdou i bez něj)
-- ---------------------------------------------------------------------------

create or replace function public.issue_document(p_document uuid, p_issue_date date default current_date) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.documents%rowtype;
  terms int;
  num text;
  series text;
begin
  select * into d from public.documents where id = p_document for update;
  if not found then raise exception 'doklad nenalezen'; end if;
  if not app.can_write(d.company_id) then raise exception 'nemáte oprávnění vystavovat doklady' using errcode = '42501'; end if;
  if d.type in ('invoice', 'invoice_non_payer', 'advance', 'credit_note') and not app.email_verified(auth.uid()) then
    raise exception 'nejdřív potvrďte svůj e-mail – odkaz jsme vám poslali' using errcode = '42501';
  end if;
  if d.status <> 'draft' then raise exception 'doklad % už je vystavený', d.number; end if;
  if d.snapshot = '{}'::jsonb then raise exception 'doklad nemá uložené položky a údaje (snapshot)'; end if;
  if d.client_id is null and d.type not in ('quote') then raise exception 'doklad nemá odběratele'; end if;

  series := d.type;
  num := app.next_number(d.company_id, series, extract(year from p_issue_date)::int);
  select c.payment_terms_days into terms from public.companies c where c.id = d.company_id;

  perform set_config('app.issuing', 'on', true);
  update public.documents set
    number = num,
    status = 'issued',
    issue_date = p_issue_date,
    taxable_date = case when d.type in ('invoice', 'invoice_non_payer', 'credit_note', 'ddpp')
                        then coalesce(d.taxable_date, p_issue_date) else d.taxable_date end,
    due_date = case when d.type in ('invoice', 'invoice_non_payer', 'advance')
                    then coalesce(d.due_date, p_issue_date + terms) else d.due_date end,
    valid_until = case when d.type = 'quote' then coalesce(d.valid_until, p_issue_date + 30) else d.valid_until end,
    issued_at = now()
  where id = p_document;
  perform set_config('app.issuing', 'off', true);
  return num;
end $$;

-- ---------------------------------------------------------------------------
-- Administrace /ssh → E-maily
-- ---------------------------------------------------------------------------

create or replace function public.admin_email_settings() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform app.require_admin();
  select jsonb_build_object(
    'has_key', exists (select 1 from vault.decrypted_secrets where name = 'resend_api_key' and coalesce(decrypted_secret, '') <> ''),
    'key_hint', (select '…' || right(decrypted_secret, 4) from vault.decrypted_secrets where name = 'resend_api_key' limit 1),
    'site_url', app.setting('site_url'),
    'mail_from', app.setting('mail_from'),
    'unverified_count', (select count(*) from app.unverified_users),
    'unverified', (select coalesce(jsonb_agg(jsonb_build_object('user_id', u.user_id, 'email', u.email, 'created_at', u.created_at,
                     'has_company', exists (select 1 from public.memberships m where m.user_id = u.user_id)) order by u.created_at desc), '[]'::jsonb)
                   from (select * from app.unverified_users order by created_at desc limit 50) u),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'to', l.to_email, 'kind', l.kind, 'created_at', l.created_at,
                'error', l.error, 'status', h.status_code, 'response', left(h.content, 300)) order by l.id desc), '[]'::jsonb)
            from (select * from app.email_log order by id desc limit 30) l
            left join net._http_response h on h.id = l.request_id)
  ) into r;
  return r;
end $$;

create or replace function public.admin_set_email_settings(p_api_key text, p_site_url text, p_mail_from text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  secret_id uuid;
  v_key text := nullif(trim(coalesce(p_api_key, '')), '');
begin
  perform app.require_admin();
  if v_key is not null then
    if v_key !~ '^re_[A-Za-z0-9_]{10,}$' then raise exception 'klíč Resend začíná „re_“ – zkontrolujte, že je celý' using errcode = '22023'; end if;
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

create or replace function public.admin_send_test_email(p_to text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  if coalesce(p_to, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'neplatný e-mail' using errcode = '22023'; end if;
  return app.send_email(trim(p_to), 'Zkušební e-mail z iRemeslo.cz', app.email_layout('E-maily fungují',
    '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Tento zkušební e-mail odeslala administrace iRemeslo.cz. '
    || 'Když ho vidíte ve schránce (a ne ve spamu), je odesílání nastavené správně.</p>'), 'test');
end $$;

/** Provozovatel může e-mail potvrdit ručně (např. když člověk napíše z ověřené adresy). */
create or replace function public.admin_verify_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  delete from app.unverified_users where user_id = p_user;
  perform app.log_admin('verify_email', null, p_user, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Úklid: nepotvrzené účty bez firmy starší 7 dnů
-- ---------------------------------------------------------------------------

create or replace function app.cleanup_unverified() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select v.user_id from app.unverified_users v
    where v.created_at < now() - interval '7 days'
      and not exists (select 1 from public.memberships m where m.user_id = v.user_id)
      and not exists (select 1 from app.platform_admins a where a.user_id = v.user_id)
  loop
    begin
      delete from auth.users where id = r.user_id;
      n := n + 1;
    exception when others then
      null; -- na účet něco odkazuje (např. záznam v administraci) – necháme ho být
    end;
  end loop;
  delete from app.email_log where created_at < now() - interval '180 days';
  delete from app.email_verifications where expires_at < now() - interval '30 days';
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('iremeslo-cleanup-unverified', '17 3 * * *', 'select app.cleanup_unverified()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Práva
-- ---------------------------------------------------------------------------

revoke all on function app.setting(text), app.email_verified(uuid), app.send_email(text, text, text, text),
  app.email_layout(text, text), app.start_verification(uuid, text), app.cleanup_unverified() from public;
revoke all on function public.signup_with_password(text, text) from public;
grant execute on function public.signup_with_password(text, text) to anon, authenticated;
revoke all on function public.my_email_status(), public.resend_verification(), public.confirm_email(text),
  public.admin_email_settings(), public.admin_set_email_settings(text, text, text), public.admin_send_test_email(text),
  public.admin_verify_user(uuid) from public;
grant execute on function public.my_email_status(), public.resend_verification() to authenticated;
grant execute on function public.confirm_email(text) to anon, authenticated;
grant execute on function public.admin_email_settings(), public.admin_set_email_settings(text, text, text),
  public.admin_send_test_email(text), public.admin_verify_user(uuid) to authenticated;
revoke all on function public.issue_document(uuid, date) from public;
grant execute on function public.issue_document(uuid, date) to authenticated;
-- Supabase dává nové funkce rovnou i rolím anon/authenticated – vnitřní funkce jim výslovně odebereme.
revoke all on function app.setting(text), app.email_verified(uuid), app.send_email(text, text, text, text),
  app.email_layout(text, text), app.start_verification(uuid, text), app.cleanup_unverified() from anon, authenticated;
revoke all on function public.my_email_status(), public.resend_verification(), public.admin_email_settings(),
  public.admin_set_email_settings(text, text, text), public.admin_send_test_email(text), public.admin_verify_user(uuid) from anon;
