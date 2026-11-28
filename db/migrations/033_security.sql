-- iŘemeslo – bezpečnost a stabilita (audit, fáze 5).
-- 1. Zjišťování registrovaných e-mailů: funkce email_registered už není volatelná z webu (kdokoli si mohl
--    ověřit, jestli je e-mail registrovaný). Po neúspěšném přihlášení web ukáže obecnou hlášku.
-- 2. Registrace: limit na adresu návštěvníka místo jednoho limitu pro celý web (stejně jako poptávky, migrace 031).
-- 3. Pevný search_path u pomocných funkcí, kterým chyběl.
-- 4. Pravidla přístupu pracovníků: auth.uid() se vyhodnotí jednou za dotaz, ne pro každý řádek.
-- 5. Indexy pro všechny cizí klíče bez indexu (rychlejší mazání a spojování tabulek).
-- 6. Záznam chyb webu a denní souhrn e-mailem provozovateli.
-- Vše jen přidává nebo zpřísňuje; žádná data se nemažou.

-- 1 ------------------------------------------------------------------------
revoke execute on function public.email_registered(text) from anon, authenticated;

-- 2 ------------------------------------------------------------------------
create table if not exists app.signup_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  src_hash text
);
create index if not exists signup_log_src_idx on app.signup_log (src_hash, created_at) where src_hash is not null;
alter table app.signup_log enable row level security;

create or replace function public.signup_with_password(p_email text, p_password text) returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  uid uuid := gen_random_uuid();
  v_src text := app.caller_ip_hash();
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
  -- Limit na adresu návštěvníka (formulář volá databázi z prohlížeče, adresu dodá Cloudflare a nejde podvrhnout)
  -- a vysoká celková pojistka. Dřív jeden limit 60/hod. pro celý web – robot mohl zastavit registrace všem.
  if v_src is not null and ((select count(*) from app.signup_log where src_hash = v_src and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from app.signup_log where src_hash = v_src and created_at > now() - interval '1 day') >= 20) then
    raise exception 'příliš mnoho registrací z jednoho místa, zkuste to později' using errcode = '53400';
  end if;
  if (select count(*) from auth.users where created_at > now() - interval '1 hour') >= 300 then
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
  insert into app.signup_log (src_hash) values (v_src);
  perform app.start_verification(uid, v_email);
  return uid;
end $$;
revoke all on function public.signup_with_password(text, text) from public;
grant execute on function public.signup_with_password(text, text) to anon, authenticated;

-- 3 ------------------------------------------------------------------------
alter function app.cz_plural(integer, text, text, text) set search_path = public, pg_temp;
alter function app.default_series_format(text) set search_path = public, pg_temp;
alter function app.doc_label(text) set search_path = public, pg_temp;
alter function app.document_hash(public.documents) set search_path = public, extensions, pg_temp;
alter function app.grace_days() set search_path = public, pg_temp;
alter function app.html_escape(text) set search_path = public, pg_temp;
alter function app.inquiry_category_label(text) set search_path = public, pg_temp;
alter function app.kc(numeric) set search_path = public, pg_temp;
alter function app.region_label(text) set search_path = public, pg_temp;
alter function app.trial_days() set search_path = public, pg_temp;

-- 4 ------------------------------------------------------------------------
alter policy time_worker_delete on public.time_entries
  using ((employee_id = app.my_employee_id(company_id)) and (created_by = (select auth.uid())) and (work_date >= (current_date - 7)));
alter policy time_worker_insert on public.time_entries
  with check ((employee_id = app.my_employee_id(company_id)) and app.is_assigned(company_id, job_id) and (created_by = (select auth.uid()))
    and (not coalesce((select c.read_only from public.companies c where c.id = time_entries.company_id), true)));
alter policy time_worker_update on public.time_entries
  using ((employee_id = app.my_employee_id(company_id)) and (created_by = (select auth.uid())) and (work_date >= (current_date - 7)))
  with check ((employee_id = app.my_employee_id(company_id)) and app.is_assigned(company_id, job_id));
alter policy attachments_worker_insert on public.attachments
  with check ((job_id is not null) and app.is_assigned(company_id, job_id) and (kind = any (array['photo_before'::text, 'photo_after'::text]))
    and (created_by = (select auth.uid())));

-- 5 ------------------------------------------------------------------------
do $$
declare
  r record;
  cols text;
  idx text;
begin
  for r in
    select c.conrelid, c.conname, n.nspname, t.relname, c.conkey
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname in ('public', 'app')
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into cols
    from unnest(r.conkey) with ordinality k(attnum, ord)
    join pg_attribute a on a.attrelid = r.conrelid and a.attnum = k.attnum;
    idx := left(r.relname || '_' || replace(replace(cols, ', ', '_'), '"', '') || '_fk_idx', 63);
    execute format('create index if not exists %I on %I.%I (%s)', idx, r.nspname, r.relname, cols);
  end loop;
end $$;

-- 6 ------------------------------------------------------------------------
create table if not exists app.error_log (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  source text not null,
  route text,
  message text not null,
  digest text,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  count int not null default 1,
  handled_at timestamptz
);
create index if not exists error_log_last_idx on app.error_log (last_at desc);
alter table app.error_log enable row level security;

/**
 * Chyba z webu (server Next.js). Stejné chyby se sčítají do jednoho řádku. Proti zahlcení: nejvýš 200 nových
 * druhů chyb za hodinu; volající tak nic nezablokuje, jen se přestanou zapisovat nové druhy.
 */
create or replace function public.report_error(p_source text, p_route text, p_message text, p_digest text default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_source text := left(coalesce(nullif(btrim(p_source), ''), 'web'), 40);
  v_route text := left(btrim(coalesce(p_route, '')), 200);
  v_msg text := left(btrim(coalesce(p_message, '')), 1000);
  fp text;
begin
  if v_msg = '' then return; end if;
  fp := encode(digest(v_source || '|' || v_route || '|' || v_msg, 'sha256'), 'hex');
  update app.error_log set count = count + 1, last_at = now(), digest = coalesce(left(p_digest, 100), digest), handled_at = null
  where fingerprint = fp;
  if found then return; end if;
  if (select count(*) from app.error_log where first_at > now() - interval '1 hour') >= 200 then return; end if;
  insert into app.error_log (fingerprint, source, route, message, digest)
  values (fp, v_source, nullif(v_route, ''), v_msg, left(p_digest, 100))
  on conflict (fingerprint) do update set count = app.error_log.count + 1, last_at = now();
end $$;
revoke all on function public.report_error(text, text, text, text) from public;
grant execute on function public.report_error(text, text, text, text) to anon, authenticated;

create or replace function public.admin_errors() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'source', e.source, 'route', e.route, 'message', e.message,
    'digest', e.digest, 'first_at', e.first_at, 'last_at', e.last_at, 'count', e.count, 'handled_at', e.handled_at) order by e.last_at desc)
    from (select * from app.error_log order by last_at desc limit 200) e), '[]'::jsonb);
end $$;
revoke all on function public.admin_errors() from public, anon;
grant execute on function public.admin_errors() to authenticated;

create or replace function public.admin_error_handled(p_id bigint, p_handled boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  update app.error_log set handled_at = case when p_handled then now() end where id = p_id;
end $$;
revoke all on function public.admin_error_handled(bigint, boolean) from public, anon;
grant execute on function public.admin_error_handled(bigint, boolean) to authenticated;

/** Denní souhrn chyb za posledních 24 hodin e-mailem provozovateli (jen když nějaké jsou). */
create or replace function app.send_error_digest() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n int;
  items text;
  site text := rtrim(coalesce(app.setting('site_url'), 'https://www.iremeslo.cz'), '/');
begin
  select count(*), string_agg('<tr><td style="padding:8px 0;border-top:1px solid #dfe4eb;font-size:14px;color:#05264c">'
           || '<strong>' || e.count || '×</strong> ' || app.html_escape(left(e.message, 200))
           || '<div style="font-size:12px;color:#556273">' || app.html_escape(coalesce(e.route, e.source)) || '</div></td></tr>', '' order by e.count desc)
    into n, items
  from (select * from app.error_log where last_at > now() - interval '24 hours' and handled_at is null order by count desc limit 10) e;
  if n = 0 then return false; end if;
  return app.send_email(coalesce(app.setting('contact_email'), 'info@iremeslo.cz'), 'Chyby na webu iRemeslo.cz za poslední den',
    app.email_layout('Chyby za poslední den',
      '<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#556273">Web zaznamenal chyby, které se ještě neoznačily jako vyřešené.</p>'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">' || items || '</table>'
      || '<p style="margin:0 0 20px"><a href="' || site || '/ssh/chyby" style="color:#b4540a;font-weight:700">Otevřít přehled chyb</a></p>'),
    'error_digest');
end $$;
revoke all on function app.send_error_digest() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('iremeslo-error-digest', '23 6 * * *', 'select app.send_error_digest()');
  end if;
end $$;
