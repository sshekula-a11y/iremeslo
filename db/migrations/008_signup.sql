-- iŘemeslo – registrace bez potvrzovacího e-mailu.
--
-- Proč: potvrzení e-mailem v Supabase závisí na nastavení v administraci Supabase (adresa webu,
-- šablona e-mailu, odesílání). Dokud není nastavené, registrace končí chybou. Tahle funkce založí
-- účet rovnou jako aktivní a aplikace člověka hned přihlásí běžným přihlášením Supabase.
--
-- Účet se zakládá stejně jako v Supabase Auth: řádek v auth.users (heslo bcrypt přes pgcrypto)
-- a identita „email“ v auth.identities. Textové tokeny musí být '' (ne NULL), jinak je Supabase Auth nenačte.
--
-- Ochrana: platný e-mail, heslo 8–72 znaků (limit bcryptu), jeden e-mail jen jednou,
-- nejvýš 60 nových účtů za hodinu pro celou platformu (proti hromadnému zakládání).

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

  return uid;
end $$;

revoke all on function public.signup_with_password(text, text) from public;
grant execute on function public.signup_with_password(text, text) to anon, authenticated;
