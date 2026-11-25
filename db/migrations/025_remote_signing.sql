-- iŘemeslo – podpis na dálku: řemeslník pošle zákazníkovi odkaz (e-mailem, SMS, WhatsApp…),
-- zákazník si listinu přečte a podepíše prstem na svém telefonu. Odkaz platí 14 dní a jen jednou;
-- v databázi je jen otisk tokenu. Po podpisu přijde řemeslníkovi e-mail.

create table if not exists app.sign_requests (
  token_hash text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  sent_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  opened_at timestamptz,
  used_at timestamptz,
  canceled_at timestamptz
);
create index if not exists sign_requests_document_idx on app.sign_requests (document_id, created_at desc);
alter table app.sign_requests enable row level security;

create or replace function app.doc_label(p_type text) returns text
language sql immutable as $$
  select case p_type
    when 'contract' then 'Smlouva o dílo' when 'handover' then 'Předávací protokol' when 'delivery' then 'Dodací list'
    when 'cash_in' then 'Příjmový pokladní doklad' when 'cash_out' then 'Výdajový pokladní doklad'
    when 'claim' then 'Reklamační protokol' when 'amendment' then 'Dodatek ke smlouvě' else 'Doklad' end
$$;

/** Společné vložení podpisu (kontroly dokladu + otisk). Volá ho sign_document i podpis přes odkaz. */
create or replace function app.add_signature(
  p_document uuid, p_side text, p_name text, p_image text, p_place text, p_user_agent text, p_user uuid
) returns public.document_signatures
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  d public.documents%rowtype;
  h text;
  r public.document_signatures;
begin
  select * into d from public.documents where id = p_document;
  if not found then raise exception 'doklad nenalezen' using errcode = 'P0002'; end if;
  if d.type not in ('contract', 'handover', 'delivery', 'cash_in', 'cash_out', 'claim', 'amendment') then
    raise exception 'tento doklad se nepodepisuje' using errcode = '22023';
  end if;
  if d.number is null or d.status in ('draft', 'canceled') then
    raise exception 'podepsat jde jen vystavený doklad' using errcode = '22023';
  end if;
  if p_side not in ('supplier', 'customer') then raise exception 'neznámá strana podpisu' using errcode = '22023'; end if;
  if exists (select 1 from public.document_signatures s where s.document_id = d.id and s.side = p_side) then
    raise exception 'doklad už je za tuto stranu podepsaný' using errcode = '23505';
  end if;

  h := app.document_hash(d);
  insert into public.document_signatures (company_id, document_id, side, signer_name, place, image, doc_hash, signature_hash, user_agent, signed_by)
  values (d.company_id, d.id, p_side, btrim(p_name), nullif(btrim(coalesce(p_place, '')), ''), p_image, h,
          encode(sha256(convert_to(h || '|' || p_side || '|' || btrim(p_name) || '|' || p_image, 'UTF8')), 'hex'),
          left(p_user_agent, 400), p_user)
  returning * into r;
  return r;
end $$;
revoke all on function app.add_signature(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.sign_document(
  p_document uuid, p_side text, p_name text, p_image text, p_place text default null, p_user_agent text default null
) returns public.document_signatures
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cid uuid;
begin
  select company_id into cid from public.documents where id = p_document;
  if cid is null then raise exception 'doklad nenalezen' using errcode = 'P0002'; end if;
  if not app.can_write(cid) then raise exception 'nemáte oprávnění podepisovat doklady' using errcode = '42501'; end if;
  return app.add_signature(p_document, p_side, p_name, p_image, p_place, p_user_agent, auth.uid());
end $$;

/** Řemeslník vytvoří odkaz k podpisu (předchozí odkaz k dokladu se zruší). Volitelně ho pošle e-mailem. */
create or replace function public.create_sign_request(p_document uuid, p_email text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  d public.documents%rowtype;
  firm text;
  token text := encode(gen_random_bytes(24), 'hex');
  link text;
  mail text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  sent boolean := false;
  exp timestamptz;
begin
  select * into d from public.documents where id = p_document;
  if not found or not app.can_write(d.company_id) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  if d.type not in ('contract', 'handover', 'delivery', 'cash_in', 'cash_out', 'claim', 'amendment') then
    raise exception 'tento doklad se nepodepisuje' using errcode = '22023';
  end if;
  if d.number is null or d.status in ('draft', 'canceled') then raise exception 'podepsat jde jen vystavený doklad' using errcode = '22023'; end if;
  if exists (select 1 from public.document_signatures s where s.document_id = d.id and s.side = 'customer') then
    raise exception 'doklad už je za tuto stranu podepsaný' using errcode = '23505';
  end if;
  if mail is not null and (length(mail) > 254 or mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'neplatný e-mail' using errcode = '22023';
  end if;

  update app.sign_requests set canceled_at = now() where document_id = d.id and used_at is null and canceled_at is null;
  insert into app.sign_requests (token_hash, company_id, document_id, created_by, sent_to)
  values (encode(digest(token, 'sha256'), 'hex'), d.company_id, d.id, auth.uid(), mail)
  returning expires_at into exp;

  link := rtrim(app.setting('site_url'), '/') || '/podpis/' || token;
  if mail is not null then
    firm := coalesce(d.snapshot #>> '{supplier,name}', (select name from public.companies where id = d.company_id));
    sent := app.send_email(mail, app.doc_label(d.type) || ' ' || d.number || ' k podpisu – ' || firm, app.email_layout('Dokument k podpisu',
      '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#556273">' || app.html_escape(firm)
      || ' vám posílá k podpisu dokument <strong style="color:#05264c">' || app.doc_label(d.type) || ' ' || app.html_escape(d.number) || '</strong>.</p>'
      || '<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#556273">Otevřete ho v telefonu, přečtěte si ho a podepište prstem. Nic neinstalujete ani se nikde neregistrujete.</p>'
      || '<p style="margin:0 0 24px"><a href="' || link || '" style="display:inline-block;background:#fe820d;color:#05264c;'
      || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Zobrazit a podepsat</a></p>'
      || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Odkaz platí do ' || to_char(exp at time zone 'Europe/Prague', 'FMDD. FMMM. YYYY')
      || '. Tlačítko nefunguje? Zkopírujte tento odkaz do prohlížeče:<br><a href="' || link || '" style="color:#b4540a;word-break:break-all">' || link || '</a></p>'),
      'sign_request');
  end if;
  return jsonb_build_object('link', link, 'expires_at', exp, 'emailed', sent);
end $$;
revoke all on function public.create_sign_request(uuid, text) from public, anon;
grant execute on function public.create_sign_request(uuid, text) to authenticated;

/** Stav posledního odkazu k dokladu (pro řemeslníka). */
create or replace function public.sign_request_status(p_document uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('created_at', r.created_at, 'expires_at', r.expires_at, 'sent_to', r.sent_to, 'opened_at', r.opened_at,
    'state', case when r.used_at is not null then 'signed' when r.canceled_at is not null then 'canceled'
                  when r.expires_at < now() then 'expired' else 'active' end)
  from app.sign_requests r
  where r.document_id = p_document and app.is_staff(r.company_id)
  order by r.created_at desc limit 1
$$;
revoke all on function public.sign_request_status(uuid) from public, anon;
grant execute on function public.sign_request_status(uuid) to authenticated;

create or replace function public.cancel_sign_request(p_document uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update app.sign_requests set canceled_at = now()
  where document_id = p_document and used_at is null and canceled_at is null and app.can_write(company_id);
end $$;
revoke all on function public.cancel_sign_request(uuid) from public, anon;
grant execute on function public.cancel_sign_request(uuid) to authenticated;

/** Veřejně: listina podle odkazu. Bez platného odkazu vrátí jen stav. */
create or replace function public.get_sign_request(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  r app.sign_requests%rowtype;
  d public.documents%rowtype;
  st text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then return jsonb_build_object('state', 'invalid'); end if;
  select * into r from app.sign_requests where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found or r.canceled_at is not null then return jsonb_build_object('state', 'invalid'); end if;
  select * into d from public.documents where id = r.document_id;
  if d.status = 'canceled' then return jsonb_build_object('state', 'invalid'); end if;
  st := case when r.used_at is not null then 'signed' when r.expires_at < now() then 'expired' else 'open' end;
  if st = 'expired' then return jsonb_build_object('state', 'expired', 'supplier', d.snapshot #>> '{supplier,name}'); end if;
  if st = 'open' and r.opened_at is null then update app.sign_requests set opened_at = now() where token_hash = r.token_hash; end if;
  return jsonb_build_object(
    'state', st,
    'document', jsonb_build_object('type', d.type, 'number', d.number, 'issue_date', d.issue_date, 'taxable_date', d.taxable_date,
                                   'due_date', d.due_date, 'valid_until', d.valid_until, 'snapshot', d.snapshot),
    'theme', (select invoice_theme from public.companies where id = d.company_id),
    'expires_at', r.expires_at,
    'signatures', coalesce((select jsonb_agg(jsonb_build_object('side', s.side, 'signer_name', s.signer_name, 'place', s.place, 'image', s.image,
                       'signed_at', s.signed_at, 'doc_hash', s.doc_hash, 'valid', s.doc_hash = app.document_hash(d)))
                     from public.document_signatures s where s.document_id = d.id), '[]'::jsonb)
  );
end $$;
revoke all on function public.get_sign_request(text) from public;
grant execute on function public.get_sign_request(text) to anon, authenticated;

/** Veřejně: zákazník podepíše přes odkaz. Odkaz se tím spotřebuje a řemeslníkovi přijde e-mail. */
create or replace function public.sign_by_token(p_token text, p_name text, p_image text, p_place text default null, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  r app.sign_requests%rowtype;
  d public.documents%rowtype;
  owner_mail text;
  link text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then raise exception 'odkaz neplatí' using errcode = '22023'; end if;
  select * into r from app.sign_requests where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found or r.canceled_at is not null then raise exception 'odkaz neplatí' using errcode = '22023'; end if;
  if r.used_at is not null then raise exception 'doklad už je za tuto stranu podepsaný' using errcode = '23505'; end if;
  if r.expires_at < now() then raise exception 'platnost odkazu vypršela' using errcode = '22023'; end if;

  perform app.add_signature(r.document_id, 'customer', p_name, p_image, p_place, p_user_agent, null);
  update app.sign_requests set used_at = now() where token_hash = r.token_hash;

  select * into d from public.documents where id = r.document_id;
  select u.email into owner_mail from auth.users u where u.id = r.created_by;
  if owner_mail is not null then
    link := rtrim(app.setting('site_url'), '/') || '/app/doklady/' || d.id;
    perform app.send_email(owner_mail, 'Podepsáno: ' || app.doc_label(d.type) || ' ' || d.number, app.email_layout('Zákazník dokument podepsal',
      '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#556273"><strong style="color:#05264c">' || app.html_escape(btrim(p_name))
      || '</strong> právě podepsal(a) dokument <strong style="color:#05264c">' || app.doc_label(d.type) || ' ' || app.html_escape(d.number) || '</strong>.</p>'
      || '<p style="margin:0 0 24px"><a href="' || link || '" style="display:inline-block;background:#fe820d;color:#05264c;'
      || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Zobrazit dokument</a></p>'),
      'sign_done');
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.sign_by_token(text, text, text, text, text) from public;
grant execute on function public.sign_by_token(text, text, text, text, text) to anon, authenticated;
