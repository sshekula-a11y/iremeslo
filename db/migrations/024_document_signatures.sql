-- iŘemeslo – podpis prstem na vystavených listinách (smlouva, předávací protokol, dodací list,
-- pokladní doklady, reklamace, dodatek). Jde o prostý elektronický podpis: obrázek podpisu,
-- jméno podepisujícího, čas serveru a otisk (SHA-256) dokladu v okamžiku podpisu.
-- Podpis se nedá změnit ani smazat; obrázek leží přímo v řádku, ne v úložišti souborů.

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  side text not null check (side in ('supplier', 'customer')),
  signer_name text not null check (length(btrim(signer_name)) between 2 and 120),
  place text check (place is null or length(place) <= 80),
  image text not null check (image like 'data:image/png;base64,%' and length(image) <= 400000),
  doc_hash text not null,
  signature_hash text not null,
  user_agent text check (user_agent is null or length(user_agent) <= 400),
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz not null default now(),
  unique (document_id, side)
);
create index if not exists document_signatures_company_idx on public.document_signatures (company_id);

alter table public.document_signatures enable row level security;
drop policy if exists document_signatures_read on public.document_signatures;
create policy document_signatures_read on public.document_signatures for select using (app.is_staff(company_id));
-- Zápis jen přes sign_document(); úpravy a mazání nejsou povolené nikomu.
revoke all on public.document_signatures from anon, authenticated;
grant select on public.document_signatures to authenticated;

/** Otisk dokladu: číslo + uložený obsah (snapshot). Doklad se po vystavení nemění, otisk tedy taky ne. */
create or replace function app.document_hash(d public.documents) returns text
language sql immutable as $$
  select encode(sha256(convert_to(coalesce(d.number, '') || '|' || d.type || '|' || d.snapshot::text, 'UTF8')), 'hex')
$$;

create or replace function public.sign_document(
  p_document uuid, p_side text, p_name text, p_image text, p_place text default null, p_user_agent text default null
) returns public.document_signatures
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.documents%rowtype;
  h text;
  r public.document_signatures;
begin
  select * into d from public.documents where id = p_document;
  if not found then raise exception 'doklad nenalezen' using errcode = 'P0002'; end if;
  if not app.can_write(d.company_id) then raise exception 'nemáte oprávnění podepisovat doklady' using errcode = '42501'; end if;
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
          left(p_user_agent, 400), auth.uid())
  returning * into r;
  return r;
end $$;
revoke all on function public.sign_document(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.sign_document(uuid, text, text, text, text, text) to authenticated;

/** Podpisy dokladu i s kontrolou, že otisk pořád sedí na doklad. */
create or replace function public.document_signatures_of(p_document uuid)
returns table (side text, signer_name text, place text, image text, signed_at timestamptz, doc_hash text, valid boolean)
language sql stable security invoker set search_path = public, pg_temp as $$
  select s.side, s.signer_name, s.place, s.image, s.signed_at, s.doc_hash, s.doc_hash = app.document_hash(d)
  from public.document_signatures s join public.documents d on d.id = s.document_id
  where s.document_id = p_document
$$;
grant execute on function public.document_signatures_of(uuid) to authenticated;
