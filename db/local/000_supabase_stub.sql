-- JEN PRO LOKÁLNÍ TESTY. V Supabase tohle všechno už existuje – tento soubor se tam NESPOUŠTÍ.
-- Napodobuje schéma auth, funkci auth.uid() a role anon / authenticated / service_role,
-- aby migrace šly beze změny pustit lokálně i v Supabase.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  -- stejné sloupce jako v Supabase (administrace provozovatele, registrace bez e-mailu)
  instance_id uuid,
  aud varchar,
  role varchar,
  encrypted_password varchar,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  confirmation_token varchar,
  recovery_token varchar,
  email_change_token_new varchar,
  email_change varchar,
  email_change_token_current varchar default '',
  phone_change text default '',
  phone_change_token varchar default '',
  reauthentication_token varchar default '',
  created_at timestamptz default now(),
  updated_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz
);
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  unique (provider_id, provider)
);
-- Šifrování hesel (v Supabase je pgcrypto ve schématu extensions).
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
-- Přihlášení (v Supabase je tabulka i s dalšími sloupci); smazáním se uživatel odhlásí.
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
);

-- Stejné chování jako v Supabase: ID přihlášeného uživatele z JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
