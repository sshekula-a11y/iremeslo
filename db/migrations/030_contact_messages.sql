-- iŘemeslo – kontaktní formulář místo zveřejněného e-mailu.
-- Zpráva se uloží do databáze (neztratí se ani při výpadku e-mailu) a kopie přijde provozovateli
-- s adresou pro odpověď (reply_to) nastavenou na odesílatele. Ochrana proti spamu: limit na e-mail,
-- na adresu IP (předává ji server webu) a celkový limit; neviditelné pole pro roboty kontroluje server.

create table if not exists app.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (length(btrim(name)) between 2 and 100),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  topic text not null check (topic in ('remeslnik', 'zakaznik', 'predplatne', 'jine')),
  message text not null check (length(btrim(message)) between 10 and 4000),
  ip_hash text,
  user_id uuid references auth.users(id) on delete set null,
  handled_at timestamptz
);
create index if not exists contact_messages_created_idx on app.contact_messages (created_at desc);
alter table app.contact_messages enable row level security;

/** Odeslání e-mailu s adresou pro odpověď (jinak stejné jako app.send_email). */
create or replace function app.send_email_reply(p_to text, p_subject text, p_html text, p_kind text, p_reply_to text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  api_key text;
  req bigint;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if coalesce(api_key, '') = '' then
    insert into app.email_log (to_email, kind, error) values (p_to, p_kind, 'chybí klíč Resend (administrace → E-maily)');
    return false;
  end if;
  req := net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', app.setting('mail_from'), 'to', jsonb_build_array(p_to), 'reply_to', p_reply_to,
                               'subject', p_subject, 'html', p_html),
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  insert into app.email_log (to_email, kind, request_id) values (p_to, p_kind, req);
  return true;
exception when others then
  insert into app.email_log (to_email, kind, error) values (p_to, p_kind, left(sqlerrm, 300));
  return false;
end $$;
revoke all on function app.send_email_reply(text, text, text, text, text) from public, anon, authenticated;

create or replace function public.send_contact_message(p_name text, p_email text, p_topic text, p_message text, p_ip_hash text default null)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  mail text := lower(btrim(coalesce(p_email, '')));
  operator_mail text := coalesce(app.setting('contact_email'), 'info@iremeslo.cz');
  topic_label text;
begin
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(mail) > 254 then raise exception 'neplatný e-mail' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'vyplňte jméno' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_message, ''))) < 10 then raise exception 'napište prosím zprávu' using errcode = '22023'; end if;
  if (select count(*) from app.contact_messages where email = mail and created_at > now() - interval '1 hour') >= 3
     or (p_ip_hash is not null and (select count(*) from app.contact_messages where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5)
     or (select count(*) from app.contact_messages where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'příliš mnoho zpráv, zkuste to prosím později' using errcode = '53400';
  end if;

  insert into app.contact_messages (name, email, topic, message, ip_hash, user_id)
  values (btrim(p_name), mail, p_topic, btrim(p_message), left(p_ip_hash, 64), auth.uid());

  topic_label := case p_topic when 'remeslnik' then 'Řemeslník – aplikace' when 'zakaznik' then 'Zákazník – poptávka'
                              when 'predplatne' then 'Předplatné a fakturace' else 'Jiné' end;
  perform app.send_email_reply(operator_mail, 'Kontaktní formulář: ' || topic_label || ' – ' || left(btrim(p_name), 60),
    app.email_layout('Zpráva z kontaktního formuláře',
      '<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#556273"><strong style="color:#05264c">' || app.html_escape(btrim(p_name))
      || '</strong> · ' || app.html_escape(mail) || ' · ' || topic_label || '</p>'
      || '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#05264c;white-space:pre-line">' || app.html_escape(btrim(p_message)) || '</p>'
      || '<p style="margin:0 0 8px;font-size:13px;color:#556273">Odpovědí na tento e-mail odpovíte přímo odesílateli.</p>'),
    'contact', mail);
  return true;
end $$;
revoke all on function public.send_contact_message(text, text, text, text, text) from public;
grant execute on function public.send_contact_message(text, text, text, text, text) to anon, authenticated;

/** Administrace: přijaté zprávy. */
create or replace function public.admin_contact_messages() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'created_at', m.created_at, 'name', m.name, 'email', m.email,
    'topic', m.topic, 'message', m.message, 'handled_at', m.handled_at) order by m.created_at desc)
    from (select * from app.contact_messages order by created_at desc limit 200) m), '[]'::jsonb);
end $$;
revoke all on function public.admin_contact_messages() from public, anon;
grant execute on function public.admin_contact_messages() to authenticated;

create or replace function public.admin_contact_handled(p_id bigint, p_handled boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_admin();
  update app.contact_messages set handled_at = case when p_handled then now() end where id = p_id;
end $$;
revoke all on function public.admin_contact_handled(bigint, boolean) from public, anon;
grant execute on function public.admin_contact_handled(bigint, boolean) to authenticated;
