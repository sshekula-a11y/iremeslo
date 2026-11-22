-- Uložení celé zakázky (hlavička + všech pět sekcí) v jedné transakci.
-- security invoker: běží s právy přihlášeného uživatele, takže platí všechna pravidla RLS.

create or replace function public.save_job(p_company uuid, p_job jsonb) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  jid uuid := nullif(p_job ->> 'id', '')::uuid;
  cid uuid := nullif(p_job ->> 'client_id', '')::uuid;
  new_client text := nullif(trim(coalesce(p_job ->> 'new_client_name', '')), '');
begin
  if not app.can_write(p_company) then
    raise exception 'nemáte oprávnění upravovat zakázky' using errcode = '42501';
  end if;

  if cid is null and new_client is not null then
    insert into public.clients (company_id, kind, name, phone, email)
    values (p_company, 'person', new_client, nullif(p_job ->> 'new_client_phone', ''), nullif(p_job ->> 'new_client_email', ''))
    returning id into cid;
  end if;

  if jid is null then
    insert into public.jobs (company_id, title, status, client_id, site_address, date_from, date_to,
                             vat_mode, vat_rate, discount_kind, discount_value, note, created_by)
    values (p_company, p_job ->> 'title', coalesce(p_job ->> 'status', 'inquiry'), cid, p_job ->> 'site_address',
            nullif(p_job ->> 'date_from', '')::date, nullif(p_job ->> 'date_to', '')::date,
            p_job ->> 'vat_mode', (p_job ->> 'vat_rate')::smallint,
            nullif(p_job ->> 'discount_kind', ''), nullif(p_job ->> 'discount_value', '')::numeric,
            p_job ->> 'note', auth.uid())
    returning id into jid;
  else
    update public.jobs set
      title = p_job ->> 'title',
      status = coalesce(p_job ->> 'status', status),
      client_id = cid,
      site_address = p_job ->> 'site_address',
      date_from = nullif(p_job ->> 'date_from', '')::date,
      date_to = nullif(p_job ->> 'date_to', '')::date,
      vat_mode = p_job ->> 'vat_mode',
      vat_rate = (p_job ->> 'vat_rate')::smallint,
      discount_kind = nullif(p_job ->> 'discount_kind', ''),
      discount_value = nullif(p_job ->> 'discount_value', '')::numeric,
      note = p_job ->> 'note'
    where id = jid and company_id = p_company;
    if not found then raise exception 'zakázka nenalezena' using errcode = '42501'; end if;
  end if;

  delete from public.job_work_items where company_id = p_company and job_id = jid;
  insert into public.job_work_items (company_id, job_id, position, description, qty, unit, unit_price)
  select p_company, jid, (t.ord - 1)::int, t.x ->> 'description', coalesce((t.x ->> 'qty')::numeric, 0),
         t.x ->> 'unit', coalesce((t.x ->> 'unit_price')::numeric, 0)
  from jsonb_array_elements(coalesce(p_job -> 'work', '[]'::jsonb)) with ordinality as t(x, ord);

  delete from public.job_materials where company_id = p_company and job_id = jid;
  insert into public.job_materials (company_id, job_id, position, description, qty_planned, qty_actual, unit,
                                    purchase_price, sale_price, billable)
  select p_company, jid, (t.ord - 1)::int, t.x ->> 'description', coalesce((t.x ->> 'qty_planned')::numeric, 0),
         nullif(t.x ->> 'qty_actual', '')::numeric, t.x ->> 'unit',
         coalesce((t.x ->> 'purchase_price')::numeric, 0), coalesce((t.x ->> 'sale_price')::numeric, 0),
         coalesce((t.x ->> 'billable')::boolean, true)
  from jsonb_array_elements(coalesce(p_job -> 'materials', '[]'::jsonb)) with ordinality as t(x, ord);

  delete from public.job_labor where company_id = p_company and job_id = jid;
  insert into public.job_labor (company_id, job_id, position, employee_id, qty_planned, qty_actual, unit, rate)
  select p_company, jid, (t.ord - 1)::int, (t.x ->> 'employee_id')::uuid, coalesce((t.x ->> 'qty_planned')::numeric, 0),
         nullif(t.x ->> 'qty_actual', '')::numeric, t.x ->> 'unit', coalesce((t.x ->> 'rate')::numeric, 0)
  from jsonb_array_elements(coalesce(p_job -> 'labor', '[]'::jsonb)) with ordinality as t(x, ord);

  delete from public.job_expenses where company_id = p_company and job_id = jid;
  insert into public.job_expenses (company_id, job_id, position, description, qty_planned, qty_actual, unit_price)
  select p_company, jid, (t.ord - 1)::int, t.x ->> 'description', coalesce((t.x ->> 'qty_planned')::numeric, 1),
         nullif(t.x ->> 'qty_actual', '')::numeric, coalesce((t.x ->> 'unit_price')::numeric, 0)
  from jsonb_array_elements(coalesce(p_job -> 'expenses', '[]'::jsonb)) with ordinality as t(x, ord);

  return jid;
end $$;

revoke all on function public.save_job(uuid, jsonb) from public, anon;
grant execute on function public.save_job(uuid, jsonb) to authenticated;
