-- Jen pro Supabase (tabulka storage.objects lokálně neexistuje). Spustit po migracích.
-- Soubory (logo, razítko, podpis, fotky, účtenky, PDF) leží v soukromém úložišti „files“
-- s cestou <company_id>/..., fotky zakázky <company_id>/jobs/<job_id>/...

insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

create policy files_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'files' and app.is_staff(((storage.foldername(name))[1])::uuid));

create policy files_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and app.can_write(((storage.foldername(name))[1])::uuid));

create policy files_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'files' and app.can_write(((storage.foldername(name))[1])::uuid));

create policy files_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'files' and app.can_write(((storage.foldername(name))[1])::uuid));

-- Pracovník: fotky jen u přiřazených zakázek
create policy files_worker_photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[2] = 'jobs'
    and app.is_assigned(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[3])::uuid)
  );

create policy files_worker_photos_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[2] = 'jobs'
    and app.is_assigned(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[3])::uuid)
  );
