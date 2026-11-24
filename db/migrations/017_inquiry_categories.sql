-- iŘemeslo – nové obory poptávek: čištění střech, fasád a dlažeb; renovace exteriérů nemovitostí.

alter table app.inquiries drop constraint if exists inquiries_category_check;
alter table app.inquiries add constraint inquiries_category_check check (category in (
  'malovani', 'fasady', 'cisteni', 'renovace', 'strechy', 'podlahy', 'obklady', 'zednicke',
  'instalace', 'elektro', 'tesarske', 'zahrada', 'uklid', 'jine'));
