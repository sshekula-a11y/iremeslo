-- iŘemeslo – další listiny: dodací list / soupis prací, příjmový a výdajový pokladní doklad,
-- upomínka a předžalobní výzva, reklamační protokol, dodatek ke smlouvě o dílo.
-- Všechny mají vlastní číselnou řadu a po vystavení se nedají měnit (stejně jako ostatní doklady).

alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents add constraint documents_type_check check (type in (
  'quote', 'advance', 'ddpp', 'invoice', 'invoice_non_payer', 'credit_note', 'contract', 'handover',
  'delivery', 'cash_in', 'cash_out', 'reminder', 'claim', 'amendment'));

create or replace function app.default_series_format(p_type text) returns text
language sql immutable as $$
  select case p_type
    when 'job' then 'Z-{RRRR}-{NNNN}'
    when 'quote' then 'CN-{RRRR}-{NNN}'
    when 'advance' then 'ZF-{RRRR}-{NNN}'
    when 'ddpp' then 'DD-{RRRR}-{NNN}'
    when 'invoice' then 'FV-{RRRR}-{NNN}'
    when 'invoice_non_payer' then '{RRRR}{NNN}'
    when 'credit_note' then 'DB-{RRRR}-{NNN}'
    when 'contract' then 'SOD-{RRRR}-{NNN}'
    when 'handover' then 'PP-{RRRR}-{NNN}'
    when 'delivery' then 'DL-{RRRR}-{NNN}'
    when 'cash_in' then 'PPD-{RRRR}-{NNN}'
    when 'cash_out' then 'VPD-{RRRR}-{NNN}'
    when 'reminder' then 'UP-{RRRR}-{NNN}'
    when 'claim' then 'RP-{RRRR}-{NNN}'
    when 'amendment' then 'DOD-{RRRR}-{NNN}'
  end
$$;

-- Vystavení: pokladní doklad nemusí mít zákazníka (platí se i dodavatelům a ostatním).
create or replace function public.issue_document(p_document uuid, p_issue_date date default current_date) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.documents%rowtype;
  terms int;
  num text;
begin
  select * into d from public.documents where id = p_document for update;
  if not found then raise exception 'doklad nenalezen'; end if;
  if not app.can_write(d.company_id) then raise exception 'nemáte oprávnění vystavovat doklady' using errcode = '42501'; end if;
  if d.type in ('invoice', 'invoice_non_payer', 'advance', 'credit_note') and not app.email_verified(auth.uid()) then
    raise exception 'nejdřív potvrďte svůj e-mail – odkaz jsme vám poslali' using errcode = '42501';
  end if;
  if d.status <> 'draft' then raise exception 'doklad % už je vystavený', d.number; end if;
  if d.snapshot = '{}'::jsonb then raise exception 'doklad nemá uložené položky a údaje (snapshot)'; end if;
  if d.client_id is null and d.type not in ('quote', 'cash_in', 'cash_out') then raise exception 'doklad nemá odběratele'; end if;
  if d.type in ('reminder', 'amendment') and d.related_document_id is null then
    raise exception 'upomínka i dodatek musí patřit k dokladu' using errcode = '22023';
  end if;

  num := app.next_number(d.company_id, d.type, extract(year from p_issue_date)::int);
  select c.payment_terms_days into terms from public.companies c where c.id = d.company_id;

  perform set_config('app.issuing', 'on', true);
  update public.documents set
    number = num,
    status = 'issued',
    issue_date = p_issue_date,
    taxable_date = case when d.type in ('invoice', 'invoice_non_payer', 'credit_note', 'ddpp')
                        then coalesce(d.taxable_date, p_issue_date) else d.taxable_date end,
    due_date = case when d.type in ('invoice', 'invoice_non_payer', 'advance')
                    then coalesce(d.due_date, p_issue_date + terms) else d.due_date end,
    valid_until = case when d.type = 'quote' then coalesce(d.valid_until, p_issue_date + 30) else d.valid_until end,
    issued_at = now()
  where id = p_document;
  perform set_config('app.issuing', 'off', true);
  return num;
end $$;
revoke all on function public.issue_document(uuid, date) from public;
grant execute on function public.issue_document(uuid, date) to authenticated;
