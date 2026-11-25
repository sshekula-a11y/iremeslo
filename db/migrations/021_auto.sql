-- iŘemeslo – nový obor „Automobilový průmysl“ (poptávky i stránka profese /remeslnici/automobilovy-prumysl).

alter table app.inquiries drop constraint if exists inquiries_category_check;
alter table app.inquiries add constraint inquiries_category_check check (category in (
  'malovani', 'fasady', 'cisteni', 'renovace', 'strechy', 'podlahy', 'obklady', 'zednicke',
  'instalace', 'elektro', 'tesarske', 'zahrada', 'uklid', 'auto', 'jine'));
alter table public.professions drop constraint if exists professions_category_check;
alter table public.professions add constraint professions_category_check check (category in (
  'malovani', 'fasady', 'cisteni', 'renovace', 'strechy', 'podlahy', 'obklady', 'zednicke',
  'instalace', 'elektro', 'tesarske', 'zahrada', 'uklid', 'auto', 'jine'));

insert into public.professions (slug, name, category, meta_title, meta_description, intro, services, price_factors, tip, faq, sort)
values ('automobilovy-prumysl', 'Automobilový průmysl', 'auto',
  'Autoservis, lakýrník a pneuservis – poptávka zdarma',
  'Oprava a servis auta, karosářské a lakýrnické práce, pneuservis nebo autoelektrikář. Zadejte poptávku zdarma, ozvou se firmy s ověřeným IČO.',
  'Autoservisy, karosáři, lakýrníci, pneuservisy i autoelektrikáři – řemesla kolem aut. Pomohou s pravidelným servisem, opravou po nehodě, přípravou na technickou kontrolu i úpravami vozidla. Do poptávky napište značku, model, rok výroby a co je potřeba; fotky poškození nebo kód závady z diagnostiky výrazně zpřesní nabídku.',
  array['Pravidelný servis a výměna oleje a filtrů', 'Opravy motoru, brzd, podvozku a výfuku', 'Karosářské a lakýrnické práce po nehodě',
        'Pneuservis, přezutí a geometrie', 'Autoelektrika a diagnostika závad', 'Příprava vozidla na technickou kontrolu'],
  array['Značka, model a stáří vozidla', 'Rozsah opravy a dostupnost dílů', 'Originální, nebo náhradní díly',
        'Diagnostika a hledání závady', 'Odtah nebo zapůjčení náhradního vozu'],
  'Uveďte VIN nebo aspoň přesný model a motorizaci – servis tak hned ověří správné díly a cenu.',
  '[{"q": "Musím mít fotky poškození?", "a": "Nejsou povinné, ale u karosářských a lakýrnických prací výrazně zpřesní nabídku."},
    {"q": "Zaniká záruka u výrobce, když jedu do nezávislého servisu?", "a": "Obecně ne, pokud servis dodrží předpisy výrobce a použije díly odpovídající kvality. Podmínky si ověřte v servisní knížce."}]'::jsonb,
  24)
on conflict (slug) do nothing;
