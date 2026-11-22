-- iŘemeslo – úpravy podle bezpečnostní kontroly Supabase (advisors).

-- 1) Pohledy pracovníka nahrazeny funkcemi (Supabase hlásí pohledy s právy vlastníka jako chybu).
--    Funkce vrací jen přiřazené zakázky a žádné ceny.
drop view if exists public.worker_jobs, public.worker_job_work, public.worker_job_materials;

create or replace function public.worker_jobs()
returns table (
  id uuid, company_id uuid, number text, title text, status text, site_address text, map_url text,
  date_from date, date_to date, time_from time, time_to time, note text, client_name text, client_phone text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select j.id, j.company_id, j.number, j.title, j.status, j.site_address, j.map_url,
         j.date_from, j.date_to, j.time_from, j.time_to, j.note, c.name, c.phone
  from public.jobs j
  left join public.clients c on c.company_id = j.company_id and c.id = j.client_id
  where auth.uid() is not null and app.is_assigned(j.company_id, j.id)
  order by j.date_from nulls last
$$;

create or replace function public.worker_job_work(p_job uuid)
returns table (id uuid, job_id uuid, "position" int, description text, qty numeric, unit text)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.id, w.job_id, w.position, w.description, w.qty, w.unit
  from public.job_work_items w
  where w.job_id = p_job and auth.uid() is not null and app.is_assigned(w.company_id, w.job_id)
  order by w.position
$$;

create or replace function public.worker_job_materials(p_job uuid)
returns table (id uuid, job_id uuid, "position" int, description text, qty_planned numeric, qty_actual numeric, unit text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.job_id, m.position, m.description, m.qty_planned, m.qty_actual, m.unit
  from public.job_materials m
  where m.job_id = p_job and auth.uid() is not null and app.is_assigned(m.company_id, m.job_id)
  order by m.position
$$;

revoke all on function public.worker_jobs(), public.worker_job_work(uuid), public.worker_job_materials(uuid) from public, anon;
grant execute on function public.worker_jobs(), public.worker_job_work(uuid), public.worker_job_materials(uuid) to authenticated;

-- 2) Pevný search_path u všech pomocných funkcí.
alter function app.touch_updated_at() set search_path = public, pg_temp;
alter function app.is_member(uuid) set search_path = public, pg_temp;
alter function app.is_staff(uuid) set search_path = public, pg_temp;
alter function app.is_owner(uuid) set search_path = public, pg_temp;
alter function app.protect_documents() set search_path = public, pg_temp;
alter function app.documents_insert_guard() set search_path = public, pg_temp;
alter function app.check_advance_deduction() set search_path = public, pg_temp;
alter function app.protect_company_flags() set search_path = public, pg_temp;
alter function app.default_series_format(text) set search_path = public, pg_temp;
alter function app.format_document_number(text, int, int) set search_path = public, pg_temp;

-- 3) Tabulka provozovatelů je jen pro servisní účet: žádná politika = žádný přístup pro uživatele.
comment on table app.platform_admins is 'Provozovatel (superadmin). Záměrně bez RLS politik: čte ji jen servisní účet a funkce security definer.';
