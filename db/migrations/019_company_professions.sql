-- iŘemeslo – profese firmy: každá firma si vybere až 5 profesí (z /remeslnici).
-- Podle nich web nabídne filtr „Moje obory“ v poptávkách (a později upozornění na nové poptávky).

create table if not exists public.company_professions (
  company_id uuid not null references public.companies(id) on delete cascade,
  profession_slug text not null references public.professions(slug) on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, profession_slug)
);
alter table public.company_professions enable row level security;
drop policy if exists company_professions_read on public.company_professions;
create policy company_professions_read on public.company_professions for select using (app.is_member(company_id));
grant select on public.company_professions to authenticated;

/** Pojistka i mimo set_company_professions: nejvýš 5 profesí na firmu. */
create or replace function app.company_professions_limit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('company_professions:' || new.company_id::text));
  if (select count(*) from public.company_professions where company_id = new.company_id) >= 5 then
    raise exception 'firma může mít nejvýše 5 profesí' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists company_professions_limit on public.company_professions;
create trigger company_professions_limit before insert on public.company_professions
  for each row execute function app.company_professions_limit();

/** Nastaví profese firmy (nahradí dosavadní). Smí jen majitel. */
create or replace function public.set_company_professions(p_company uuid, p_slugs text[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v text[];
begin
  if not app.is_owner(p_company) then raise exception 'profese firmy může měnit jen majitel' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct s), '{}') into v from unnest(coalesce(p_slugs, '{}')) s where s is not null and s <> '';
  if cardinality(v) > 5 then raise exception 'firma může mít nejvýše 5 profesí' using errcode = '23514'; end if;
  if exists (select 1 from unnest(v) s where not exists (select 1 from public.professions p where p.slug = s and p.published)) then
    raise exception 'neznámá profese' using errcode = '22023';
  end if;
  delete from public.company_professions where company_id = p_company and profession_slug <> all (v);
  insert into public.company_professions (company_id, profession_slug)
  select p_company, s from unnest(v) s on conflict do nothing;
end $$;

-- Seznam poptávek: navíc filtr více oborů najednou (p_categories = obory profesí firmy).
drop function if exists public.list_inquiries(text, text, int, int, text, int);
create or replace function public.list_inquiries(p_category text default null, p_city text default null,
                                                 p_limit int default 20, p_offset int default 0,
                                                 p_region text default null, p_days int default null,
                                                 p_categories text[] default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with live as (
    select * from app.inquiries i where i.status = 'open' and i.expires_at >= now()
  ), f as (
    select * from live i
    where not i.is_demo
      and (coalesce(p_category, '') = '' or i.category = p_category)
      and (p_categories is null or cardinality(p_categories) = 0 or i.category = any (p_categories))
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

revoke all on function app.company_professions_limit() from public, anon, authenticated;
revoke all on function public.set_company_professions(uuid, text[]) from public, anon;
grant execute on function public.set_company_professions(uuid, text[]) to authenticated;
revoke all on function public.list_inquiries(text, text, int, int, text, int, text[]) from public;
grant execute on function public.list_inquiries(text, text, int, int, text, int, text[]) to anon, authenticated;
