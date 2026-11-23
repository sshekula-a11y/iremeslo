-- iŘemeslo – má e-mail účet? Po neúspěšném přihlášení aplikace podle toho rovnou přepne na registraci.
--
-- Vědomý kompromis: kdo zkusí přihlášení, zjistí, jestli e-mail v iRemeslo účet má (stejně jako u mnoha
-- jiných služeb). Funkce vrací jen ano/ne, žádné další údaje. Volá se jen po neúspěšném přihlášení.

create or replace function public.email_registered(p_email text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(trim(coalesce(p_email, ''))))
$$;

revoke all on function public.email_registered(text) from public;
grant execute on function public.email_registered(text) to anon, authenticated;
