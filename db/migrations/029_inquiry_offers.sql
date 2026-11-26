-- iŘemeslo – nabídky v systému a jejich porovnání (rozhodnutí č. 5).
-- Řemeslník (firma s IČO ověřeným v ARES) pošle k poptávce nabídku: cena, kdy může začít, doba práce, zpráva.
-- Zákazník dostane e-mail s odkazem na správu poptávky, kde nabídky porovná a jednu vybere. Vybraná firma
-- dostane kontakt, ostatním přijde zdvořilé odmítnutí a poptávka se uzavře. Ceny jiných firem řemeslník nevidí.

create table if not exists app.inquiry_offers (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references app.inquiries(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  price numeric(12, 2) not null check (price > 0 and price < 100000000),
  vat_note text not null check (vat_note in ('with_vat', 'non_payer')),
  start_date date,
  duration text check (duration is null or length(duration) <= 80),
  message text not null check (length(btrim(message)) between 10 and 2000),
  valid_until date not null,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (inquiry_id, company_id)
);
create index if not exists inquiry_offers_company_idx on app.inquiry_offers (company_id, created_at desc);
alter table app.inquiry_offers enable row level security;

-- Další odkazy pro zadavatele (v e-mailu o nové nabídce). Ukládá se jen otisk, stejně jako u původního odkazu.
create table if not exists app.inquiry_tokens (
  token_hash text primary key,
  inquiry_id uuid not null references app.inquiries(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app.inquiry_tokens enable row level security;

create or replace function app.inquiry_id_by_token(p_token text) returns uuid
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce(
    (select i.id from app.inquiries i where i.token_hash = encode(digest(p_token, 'sha256'), 'hex')),
    (select t.inquiry_id from app.inquiry_tokens t where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')))
  where coalesce(p_token, '') ~ '^[0-9a-f]{64}$'
$$;

/** Nový odkaz na správu poptávky (do e-mailu). */
create or replace function app.inquiry_new_link(p_inquiry uuid) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into app.inquiry_tokens (token_hash, inquiry_id) values (encode(digest(token, 'sha256'), 'hex'), p_inquiry);
  return rtrim(coalesce(app.setting('site_url'), 'https://www.iremeslo.cz'), '/') || '/poptavky/sprava?t=' || token;
end $$;

create or replace function app.kc(p numeric) returns text
language sql immutable as $$
  select replace(replace(replace(to_char(p, 'FM999,999,999,990.00'), ',', ' '), '.', ','), ' ', ' ') || ' Kč'
$$;

-- Správa poptávky přijímá původní odkaz i odkazy z e-mailů o nabídkách.
create or replace function public.confirm_inquiry(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  i app.inquiries%rowtype;
  first_confirm boolean := false;
  iid uuid := app.inquiry_id_by_token(p_token);
begin
  if iid is null then return jsonb_build_object('ok', false); end if;
  select * into i from app.inquiries where id = iid for update;
  if i.status = 'pending' then
    if i.created_at < now() - interval '3 days' then return jsonb_build_object('ok', false); end if;
    update app.inquiries set status = 'open', confirmed_at = now(), expires_at = now() + interval '60 days'
    where id = i.id returning * into i;
    first_confirm := true;
  end if;
  return jsonb_build_object('ok', true, 'just_confirmed', first_confirm, 'inquiry', app.inquiry_public(i));
end $$;

create or replace function public.close_inquiry(p_token text) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare iid uuid := app.inquiry_id_by_token(p_token);
begin
  if iid is null then return false; end if;
  update app.inquiries set status = 'closed', closed_at = now() where id = iid and status = 'open';
  return found;
end $$;

/** Řemeslník pošle nebo upraví nabídku. Zákazník dostane e-mail jen u první nabídky od firmy. */
create or replace function public.send_offer(p_company uuid, p_inquiry uuid, p_price numeric, p_start date, p_duration text,
                                             p_message text, p_valid_days int default 14) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  i app.inquiries%rowtype;
  c public.companies%rowtype;
  o app.inquiry_offers%rowtype;
  is_new boolean;
  link text;
begin
  if not app.can_write(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  if not app.email_verified(auth.uid()) then raise exception 'nejdřív potvrďte svůj e-mail' using errcode = '42501'; end if;
  select * into c from public.companies where id = p_company;
  if c.ico_verified_at is null then raise exception 'nabídku pošle jen firma s IČO ověřeným v ARES' using errcode = '42501'; end if;
  select * into i from app.inquiries where id = p_inquiry;
  if not found or i.status <> 'open' or i.expires_at < now() then raise exception 'poptávka už nepřijímá nabídky' using errcode = '22023'; end if;
  if i.is_demo then raise exception 'u ukázkové poptávky nabídku poslat nejde' using errcode = '22023'; end if;
  if p_price is null or p_price <= 0 then raise exception 'zadejte cenu' using errcode = '22023'; end if;
  if p_start is not null and p_start < current_date then raise exception 'termín zahájení nemůže být v minulosti' using errcode = '22023'; end if;
  if coalesce(p_valid_days, 14) not between 3 and 90 then raise exception 'platnost nabídky 3–90 dní' using errcode = '22023'; end if;
  if (select count(*) from app.inquiry_offers x where x.company_id = p_company and x.created_at > now() - interval '1 day') >= 30 then
    raise exception 'dnes jste poslali už 30 nabídek' using errcode = 'P0001';
  end if;

  select * into o from app.inquiry_offers where inquiry_id = p_inquiry and company_id = p_company for update;
  is_new := not found or o.status = 'withdrawn';
  if found and o.status in ('accepted', 'declined') then raise exception 'zákazník už o nabídce rozhodl' using errcode = '22023'; end if;

  insert into app.inquiry_offers (inquiry_id, company_id, created_by, price, vat_note, start_date, duration, message, valid_until)
  values (p_inquiry, p_company, auth.uid(), round(p_price, 2), case when c.vat_payer then 'with_vat' else 'non_payer' end,
          p_start, nullif(btrim(coalesce(p_duration, '')), ''), btrim(p_message), current_date + coalesce(p_valid_days, 14))
  on conflict (inquiry_id, company_id) do update set
    price = excluded.price, vat_note = excluded.vat_note, start_date = excluded.start_date, duration = excluded.duration,
    message = excluded.message, valid_until = excluded.valid_until, status = 'sent', updated_at = now(), created_by = excluded.created_by
  returning * into o;

  if is_new then
    link := app.inquiry_new_link(i.id);
    perform app.send_email(i.contact_email, 'Nová nabídka k poptávce: ' || i.title, app.email_layout('Máte novou nabídku',
      '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#556273">K vaší poptávce <strong style="color:#05264c">„' || app.html_escape(i.title)
      || '“</strong> poslal nabídku <strong style="color:#05264c">' || app.html_escape(c.name) || '</strong> (IČO ' || coalesce(c.ico, '') || ', ověřeno v ARES).</p>'
      || '<p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#05264c">' || app.kc(o.price)
      || '<span style="font-size:14px;font-weight:400;color:#556273">' || case o.vat_note when 'with_vat' then ' vč. DPH' else ' (neplátce DPH)' end || '</span></p>'
      || '<p style="margin:0 0 24px"><a href="' || link || '#nabidky" style="display:inline-block;background:#fe820d;color:#05264c;'
      || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Zobrazit a porovnat nabídky</a></p>'
      || '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#556273">Nabídky si v klidu porovnejte. Až si vyberete, klepněte u nabídky na „Vybrat“ – firma dostane váš kontakt a ostatním dáme vědět.</p>'),
      'offer_new');
  end if;
  return jsonb_build_object('id', o.id, 'new', is_new);
end $$;
revoke all on function public.send_offer(uuid, uuid, numeric, date, text, text, int) from public, anon;
grant execute on function public.send_offer(uuid, uuid, numeric, date, text, text, int) to authenticated;

create or replace function public.withdraw_offer(p_company uuid, p_offer uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.can_write(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  update app.inquiry_offers set status = 'withdrawn', updated_at = now() where id = p_offer and company_id = p_company and status = 'sent';
  return found;
end $$;
revoke all on function public.withdraw_offer(uuid, uuid) from public, anon;
grant execute on function public.withdraw_offer(uuid, uuid) to authenticated;

/** Nabídka mé firmy k poptávce (pro formulář v detailu poptávky) a kolik nabídek už poptávka má. */
create or replace function public.my_offer_for(p_company uuid, p_inquiry uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_staff(p_company) then return null; end if;
  return jsonb_build_object(
    'offer', (select jsonb_build_object('id', o.id, 'price', o.price, 'start_date', o.start_date, 'duration', o.duration, 'message', o.message,
                                        'valid_until', o.valid_until, 'status', o.status, 'updated_at', o.updated_at)
              from app.inquiry_offers o where o.inquiry_id = p_inquiry and o.company_id = p_company),
    'count', (select count(*) from app.inquiry_offers o where o.inquiry_id = p_inquiry and o.status in ('sent', 'accepted')));
end $$;
revoke all on function public.my_offer_for(uuid, uuid) from public, anon;
grant execute on function public.my_offer_for(uuid, uuid) to authenticated;

/** Odeslané nabídky firmy; u vybraných i kontakt na zákazníka. */
create or replace function public.my_offers(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_staff(p_company) then raise exception 'nemáte oprávnění' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'inquiry_id', i.id, 'title', i.title, 'city', i.city, 'category', i.category,
      'inquiry_status', case when i.status = 'open' and i.expires_at < now() then 'expired' else i.status end,
      'price', o.price, 'vat_note', o.vat_note, 'start_date', o.start_date, 'duration', o.duration, 'status', o.status,
      'created_at', o.created_at, 'decided_at', o.decided_at, 'valid_until', o.valid_until,
      'contact', case when o.status = 'accepted' then jsonb_build_object('name', i.contact_name, 'phone', i.contact_phone,
                       'email', i.contact_email, 'street', i.street, 'city', i.city, 'zip', i.zip) end)
      order by o.created_at desc)
    from app.inquiry_offers o join app.inquiries i on i.id = o.inquiry_id
    where o.company_id = p_company and o.status <> 'withdrawn'), '[]'::jsonb);
end $$;
revoke all on function public.my_offers(uuid) from public, anon;
grant execute on function public.my_offers(uuid) to authenticated;

/** Pro zadavatele (odkaz z e-mailu): nabídky k porovnání. Kontakt na firmu až u vybrané nabídky. */
create or replace function public.inquiry_offers(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare iid uuid := app.inquiry_id_by_token(p_token);
begin
  if iid is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'firm', c.name, 'ico', c.ico, 'city', c.city, 'web', c.web,
      'professions', (select jsonb_agg(p.name order by p.name) from public.company_professions cp join public.professions p on p.slug = cp.profession_slug where cp.company_id = c.id),
      'price', o.price, 'vat_note', o.vat_note, 'start_date', o.start_date, 'duration', o.duration, 'message', o.message,
      'valid_until', o.valid_until, 'status', o.status, 'created_at', o.created_at,
      'phone', case when o.status = 'accepted' then c.phone end,
      'email', case when o.status = 'accepted' then coalesce(c.email, (select u.email from public.memberships m join auth.users u on u.id = m.user_id
                                                                     where m.company_id = c.id and m.role = 'owner' order by m.created_at limit 1)) end)
      order by case o.status when 'accepted' then 0 when 'sent' then 1 else 2 end, o.price)
    from app.inquiry_offers o join public.companies c on c.id = o.company_id
    where o.inquiry_id = iid and o.status <> 'withdrawn'), '[]'::jsonb);
end $$;
revoke all on function public.inquiry_offers(text) from public;
grant execute on function public.inquiry_offers(text) to anon, authenticated;

/** Zadavatel vybere nebo odmítne nabídku. Výběr uzavře poptávku a ostatní nabídky odmítne. */
create or replace function public.decide_offer(p_token text, p_offer uuid, p_decision text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  iid uuid := app.inquiry_id_by_token(p_token);
  i app.inquiries%rowtype;
  o app.inquiry_offers%rowtype;
  r record;
  owner_mail text;
  site text := rtrim(coalesce(app.setting('site_url'), 'https://www.iremeslo.cz'), '/');
begin
  if iid is null then raise exception 'odkaz neplatí' using errcode = '22023'; end if;
  if p_decision not in ('accept', 'decline') then raise exception 'neznámé rozhodnutí' using errcode = '22023'; end if;
  select * into i from app.inquiries where id = iid for update;
  select * into o from app.inquiry_offers where id = p_offer and inquiry_id = iid for update;
  if not found or o.status <> 'sent' then raise exception 'o nabídce už je rozhodnuto' using errcode = '22023'; end if;
  if p_decision = 'accept' and (i.status <> 'open') then raise exception 'poptávka je už uzavřená' using errcode = '22023'; end if;

  update app.inquiry_offers set status = case p_decision when 'accept' then 'accepted' else 'declined' end, decided_at = now(), updated_at = now()
  where id = o.id;

  for r in
    select x.id, x.status, c.name, (select u.email from public.memberships m join auth.users u on u.id = m.user_id
                                     where m.company_id = c.id and m.role = 'owner' order by m.created_at limit 1) as mail,
           x.id = o.id as chosen
    from app.inquiry_offers x join public.companies c on c.id = x.company_id
    where x.inquiry_id = iid and (x.id = o.id or (p_decision = 'accept' and x.status = 'sent'))
  loop
    if r.mail is null then continue; end if;
    if r.chosen and p_decision = 'accept' then
      perform app.send_email(r.mail, 'Zákazník vybral vaši nabídku: ' || i.title, app.email_layout('Gratulujeme, zakázka je vaše',
        '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#556273">Zákazník vybral vaši nabídku k poptávce <strong style="color:#05264c">„' || app.html_escape(i.title) || '“</strong>. Ozvěte se mu prosím co nejdřív:</p>'
        || '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#05264c"><strong>' || app.html_escape(i.contact_name) || '</strong><br>'
        || coalesce(app.html_escape(i.contact_phone) || '<br>', '') || app.html_escape(i.contact_email) || '<br>'
        || app.html_escape(coalesce(i.street || ', ', '') || i.city) || '</p>'
        || '<p style="margin:0 0 24px"><a href="' || site || '/app/nabidky" style="display:inline-block;background:#fe820d;color:#05264c;'
        || 'font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px">Otevřít v aplikaci</a></p>'),
        'offer_accepted');
    elsif not r.chosen or p_decision = 'decline' then
      perform app.send_email(r.mail, 'Poptávka: ' || i.title, app.email_layout('Zákazník vybral jinou nabídku',
        '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#556273">Děkujeme za nabídku k poptávce <strong style="color:#05264c">„' || app.html_escape(i.title)
        || '“</strong>. Zákazník se tentokrát rozhodl jinak. Další poptávky z vašich oborů najdete na iRemeslo.cz.</p>'
        || '<p style="margin:0 0 24px"><a href="' || site || '/poptavky?moje=1" style="color:#b4540a;font-weight:700">Zobrazit nové poptávky</a></p>'),
        'offer_declined');
    end if;
  end loop;

  if p_decision = 'accept' then
    update app.inquiry_offers set status = 'declined', decided_at = now(), updated_at = now() where inquiry_id = iid and status = 'sent';
    update app.inquiries set status = 'closed', closed_at = now() where id = iid and status = 'open';
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.decide_offer(text, uuid, text) from public;
grant execute on function public.decide_offer(text, uuid, text) to anon, authenticated;
