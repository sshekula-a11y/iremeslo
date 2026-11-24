-- iŘemeslo – fotky k poptávce (fáze B).
--
-- Zákazník (bez přihlášení) nahraje až 6 fotek do veřejného úložiště inquiry-photos/<složka>/<soubor>.
-- Složku (náhodné [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}) vytvoří prohlížeč; při odeslání poptávky se k ní připojí (photos_folder).
--  * nahrávat jde jen do složky, která ještě nepatří starší poptávce, nejvýš 6 souborů, 5 MB, jen obrázky,
--  * mazat jde jen fotky, které nepatří nepotvrzené ani aktivní poptávce (rozpracované, opuštěné, uzavřené),
--  * úklid jednou denně smaže přes Storage API opuštěné složky (starší než den) a fotky uzavřených a prošlých poptávek.
-- Databáze soubory v úložišti smazat přímo nesmí, proto úklid volá Storage API (pg_net) s veřejným klíčem.
-- Pomocné funkce pravidel jsou ve schématu public: pravidla úložiště je volají i za nepřihlášené (anon).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inquiry-photos', 'inquiry-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table app.inquiries add column if not exists photos_folder uuid unique;

-- Adresa projektu a veřejný (publishable) klíč pro volání Storage API z úklidu. Oba jsou veřejné.
insert into app.settings (key, value) values
  ('supabase_url', 'https://pisrgrqbspayqdkdeuwg.supabase.co'),
  ('supabase_publishable_key', 'sb_publishable_Z4ciqoeBJSm863A7QtZIAw_qOmfmG2v')
on conflict (key) do nothing;

/** Fotky poptávky (názvy souborů v úložišti) v pořadí nahrání. */
create or replace function app.inquiry_photos(p_folder uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(o.name order by o.created_at, o.name), '[]'::jsonb)
  from storage.objects o where o.bucket_id = 'inquiry-photos' and o.name like p_folder::text || '/%'
$$;

/** Smí se do úložiště nahrát soubor s tímto názvem? (pravidlo úložiště) */
create or replace function public.inquiry_photo_upload_ok(p_name text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_folder text := split_part(p_name, '/', 1);
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8,32}\.(jpg|png|webp)$' then return false; end if;
  if (select count(*) from storage.objects where bucket_id = 'inquiry-photos' and name like v_folder || '/%') >= 6 then return false; end if;
  -- ke staré poptávce už nikdo nic nepřidá
  if exists (select 1 from app.inquiries where photos_folder = v_folder::uuid and created_at < now() - interval '1 hour') then return false; end if;
  -- pojistka proti zahlcení úložiště
  if (select count(*) from storage.objects where bucket_id = 'inquiry-photos' and created_at > now() - interval '1 hour') >= 600 then return false; end if;
  return true;
end $$;

/** Smí se fotka smazat? Jen pokud nepatří nepotvrzené ani aktivní poptávce. (pravidlo úložiště) */
create or replace function public.inquiry_photo_deletable(p_name text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return not exists (select 1 from app.inquiries where photos_folder = v_folder::uuid
                     and (status = 'pending' or (status = 'open' and expires_at >= now())));
end $$;

drop policy if exists inquiry_photos_insert on storage.objects;
create policy inquiry_photos_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'inquiry-photos' and public.inquiry_photo_upload_ok(name));
drop policy if exists inquiry_photos_select on storage.objects;
create policy inquiry_photos_select on storage.objects for select to anon, authenticated
  using (bucket_id = 'inquiry-photos' and public.inquiry_photo_deletable(name));
drop policy if exists inquiry_photos_delete on storage.objects;
create policy inquiry_photos_delete on storage.objects for delete to anon, authenticated
  using (bucket_id = 'inquiry-photos' and public.inquiry_photo_deletable(name));

create or replace function app.inquiry_public(i app.inquiries) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', i.id, 'created_at', coalesce(i.confirmed_at, i.created_at), 'status',
    case when i.status = 'open' and i.expires_at < now() then 'expired' else i.status end,
    'category', i.category, 'title', i.title, 'quantity', i.quantity, 'unit', i.unit,
    'description', i.description, 'city', i.city, 'zip', i.zip, 'region', i.region,
    'term', i.term, 'term_from', i.term_from, 'term_date', i.term_date,
    'expires_at', i.expires_at, 'is_demo', i.is_demo,
    -- fotky jen u nepotvrzené a aktivní poptávky (po uzavření je úklid smaže)
    'photos', case when i.photos_folder is not null and i.status in ('pending', 'open') then app.inquiry_photos(i.photos_folder) else '[]'::jsonb end,
    'views', (select count(*) from app.inquiry_contact_views v where v.inquiry_id = i.id)
  )
$$;

create or replace function public.submit_inquiry(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_email text := lower(trim(coalesce(p ->> 'contact_email', '')));
  v_title text := trim(coalesce(p ->> 'title', ''));
  v_term text := coalesce(nullif(p ->> 'term', ''), 'flexible');
  v_term_date date := nullif(p ->> 'term_date', '')::date;
  v_term_from date := nullif(p ->> 'term_from', '')::date;
  v_phone text := nullif(regexp_replace(trim(coalesce(p ->> 'contact_phone', '')), '\s+', ' ', 'g'), '');
  v_zip text := nullif(trim(coalesce(p ->> 'zip', '')), '');
  v_region text := coalesce(nullif(p ->> 'region', ''), app.region_from_zip(nullif(trim(coalesce(p ->> 'zip', '')), '')));
  v_folder text := nullif(p ->> 'photos_folder', '');
  token text := encode(gen_random_bytes(32), 'hex');
  new_id uuid;
  link text;
  sent boolean;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'neplatný e-mail' using errcode = '22023';
  end if;
  if v_term = 'date' then
    if v_term_from is null and v_term_date is null then
      raise exception 'zadejte datum zahájení nebo dokončení' using errcode = '22023';
    end if;
    if coalesce(v_term_from, current_date) < current_date or coalesce(v_term_date, current_date) < current_date then
      raise exception 'zadejte termín v budoucnosti' using errcode = '22023';
    end if;
    if v_term_from is not null and v_term_date is not null and v_term_date < v_term_from then
      raise exception 'dokončení nesmí být před zahájením' using errcode = '22023';
    end if;
  end if;
  if v_folder is not null and v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'neplatné fotky' using errcode = '22023';
  end if;
  if v_folder is not null and exists (select 1 from app.inquiries where photos_folder = v_folder::uuid) then
    raise exception 'fotky už patří jiné poptávce' using errcode = '22023';
  end if;
  if (select count(*) from app.inquiries where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'příliš mnoho poptávek, zkuste to za chvíli' using errcode = '53400';
  end if;
  if (select count(*) from app.inquiries where contact_email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'z tohoto e-mailu bylo dnes zadáno příliš mnoho poptávek' using errcode = '53400';
  end if;

  insert into app.inquiries (category, title, quantity, unit, description, city, zip, region, street, term, term_from, term_date,
                             contact_name, contact_phone, contact_email, token_hash, photos_folder)
  values (p ->> 'category', v_title, nullif(p ->> 'quantity', '')::numeric, nullif(p ->> 'unit', ''),
          trim(coalesce(p ->> 'description', '')), trim(coalesce(p ->> 'city', '')), v_zip, v_region,
          nullif(trim(coalesce(p ->> 'street', '')), ''), v_term, case when v_term = 'date' then v_term_from end,
          case when v_term = 'date' then v_term_date end,
          trim(coalesce(p ->> 'contact_name', '')), v_phone, v_email, encode(digest(token, 'sha256'), 'hex'), v_folder::uuid)
  returning id into new_id;

  link := rtrim(app.setting('site_url'), '/') || '/poptavky/sprava?t=' || token;
  sent := app.send_email(v_email, 'Potvrďte svou poptávku na iRemeslo.cz', app.email_layout('Potvrďte svou poptávku',
    '<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#556273">Děkujeme za zadání poptávky '
    || '<strong style="color:#05264c">„' || app.html_escape(v_title) || '“</strong>.</p>'
    || '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Poptávku zveřejníme, jakmile ji potvrdíte. '
    || 'Ozvou se vám řemeslníci s IČO ověřeným v ARES.</p>'
    || '<p style="margin:0 0 24px"><a href="' || link || '" style="display:inline-block;background:#fe820d;color:#05264c;'
    || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Potvrdit a zveřejnit poptávku</a></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Stejným odkazem poptávku později uzavřete, '
    || 'až najdete dodavatele. E-mail si proto uschovejte.<br>Tlačítko nefunguje? Zkopírujte tento odkaz do prohlížeče:<br>'
    || '<span style="word-break:break-all;color:#b4540a">' || link || '</span></p>'
    || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Pokud jste poptávku nezadali, e-mail ignorujte – '
    || 'nepotvrzenou poptávku do 3 dnů smažeme.</p>'), 'poptavka');
  return jsonb_build_object('id', new_id, 'email_sent', sent);
end $$;

/** Úklid fotek: opuštěné složky starší než den a fotky uzavřených či skrytých poptávek. Vrací počet souborů k smazání. */
create or replace function app.cleanup_inquiry_photos() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_names text[];
begin
  with f as (
    select split_part(o.name, '/', 1) as folder, min(o.created_at) as first_at, array_agg(o.name) as names
    from storage.objects o where o.bucket_id = 'inquiry-photos' group by 1
  ), d as (
    select f.names from f left join app.inquiries i on i.photos_folder::text = f.folder
    where (i.id is null and f.first_at < now() - interval '1 day') or i.status in ('closed', 'hidden')
       or (i.status = 'open' and i.expires_at < now())
  )
  select array_agg(n) into v_names from (select unnest(d.names) n from d limit 1000) x;
  if v_names is null then return 0; end if;
  perform net.http_delete(
    url := rtrim(app.setting('supabase_url'), '/') || '/storage/v1/object/inquiry-photos',
    headers := jsonb_build_object('apikey', app.setting('supabase_publishable_key'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 20000,
    body := jsonb_build_object('prefixes', to_jsonb(v_names)));
  return cardinality(v_names);
end $$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('iremeslo-cleanup-inquiry-photos', '37 3 * * *', 'select app.cleanup_inquiry_photos()');
  end if;
end $$;

revoke all on function app.inquiry_photos(uuid), app.cleanup_inquiry_photos() from public, anon, authenticated;
revoke all on function public.inquiry_photo_upload_ok(text), public.inquiry_photo_deletable(text) from public;
grant execute on function public.inquiry_photo_upload_ok(text), public.inquiry_photo_deletable(text) to anon, authenticated;
revoke all on function public.submit_inquiry(jsonb) from public;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;
