# iŘemeslo

Řízení zakázek, cenové nabídky a faktury pro řemeslníky a malé firmy. Web **iremeslo.cz**.

Tohle je základ aplikace: výpočty a databáze. Na nich bude stát webová aplikace (Next.js) a mobilní verze (PWA).

## Co už je hotové

| Část | Kde | Co dělá |
| --- | --- | --- |
| Výpočty zakázky | `packages/core/src/job.ts` | práce, materiál (nákup/prodej, účtovat ano/ne), lidé, výdaje, sleva % nebo částkou, DPH, výdělek, marže, varování při nízké marži, plán vs. skutečnost |
| Faktury a zálohy | `packages/core/src/invoice.ts` | rekapitulace DPH po sazbách 21/12/0 %, sleva na celou fakturu, přenesená daňová povinnost, neplátce, záloha v % nebo částkou, DDPP (DPH z přijaté platby), odečet záloh, zaokrouhlení na koruny |
| QR Platba | `packages/core/src/spayd.ts` | text pro QR kód na faktuře (formát SPAYD) |
| Účet a IČO | `bank.ts`, `ico.ts` | kontrola čísla účtu, převod na IBAN, kontrola IČO a DIČ |
| Číselné řady | `numbering.ts` | FV-2026-001, ZF-…, DD-…, 2026001 pro neplátce, vlastní formáty |
| Databáze | `db/migrations/` | všechny tabulky ze zadání, oddělení firem (Row Level Security), role majitel / kancelář / pracovník, číslování dokladů bez mezer, zamčené vystavené doklady, audit log, pozvánky, limit uživatelů podle tarifu, režim „jen pro čtení“ |

Peníze se počítají v celých haléřích (v databázi `numeric`), nikdy ve float.

## Testy

```bash
npm test          # výpočty: 26 testů včetně kontrolního příkladu ze zadání
npm run test:db   # databáze: 63 kontrol oddělení firem, rolí a dokladů (potřebuje PostgreSQL 15+)
npm run typecheck
```

Kontrolní příklad ze zadání dává přesně: cena bez DPH 58 200 Kč, náklady 35 400 Kč, výdělek 22 800 Kč (39,2 %), s DPH 12 % 65 184 Kč.

Test databáze ověřuje akceptační kritérium „uživatel firmy A nevidí žádná data firmy B ani přes přímou URL nebo API“, a dál:
pracovník vidí jen přiřazené zakázky a žádné ceny, vystavený doklad nejde smazat ani přepsat,
faktury jdou po sobě bez mezer, nezaplacenou zálohu nejde odečíst a jednu zálohu nejde odečíst dvakrát.

## Provoz zdarma (beta)

| Služba | Na co | Tarif |
| --- | --- | --- |
| Supabase | databáze, přihlášení, soubory | Free: 500 MB databáze, projekt se uspí po týdnu bez aktivity, bez automatických záloh → vlastní denní záloha přes GitHub Actions |
| Vercel | web | Hobby jen pro nekomerční použití; před prvními platbami přejít na Pro |
| Resend | e-maily (pozvánky, faktury) | Free: 3 000/měsíc, max. 100/den |

PDF dokladů se vytváří v prohlížeči uživatele, server tím nezatěžuje.
Všichni noví zákazníci dostanou tarif **Beta zdarma** (`plans.beta`). Placené tarify Základní (199 Kč / 1 999 Kč) a Bez limitu (299 Kč / 2 999 Kč) jsou v databázi připravené, ale skryté.

## Nasazení databáze do Supabase

1. Založit projekt v Supabase (region Frankfurt, `eu-central-1`).
2. V SQL editoru spustit po řadě `db/migrations/001_schema.sql`, `002_security.sql`, `003_functions.sql`, potom `db/supabase/storage.sql`.
3. Soubor `db/local/000_supabase_stub.sql` se v Supabase **nespouští**, je jen pro lokální testy.

Nové tabulky přidané později musí dostat `enable row level security` a vlastní politiky, jinak k nim aplikace nebude mít přístup.

## K ověření s daňovým poradcem

- postup u DDPP (DPH z přijaté zálohy, vystavení do 15 dnů) a odečet záloh na konečné faktuře;
- texty „Daň odvede zákazník“ a „Nejsem plátce DPH“, povinné údaje na faktuře;
- zaokrouhlení celkové částky na koruny mimo základ daně.

## Další kroky

1. Webová aplikace Next.js nad touto databází: registrace s IČO (ARES), zakázka s pěti sekcemi a živým souhrnem, klienti, ceník (hotovo), kalendář.
2. PDF nabídky a faktury podle návrhu (barevné varianty, logo, razítko, podpis, QR Platba).
3. Odesílání e-mailem, pozvánky kolegů, superadmin.

## Webová aplikace (`apps/web`)

Next.js 16 + Supabase (přihlášení e-mailem a heslem, data přes RLS). Spuštění:

```bash
cp apps/web/.env.example apps/web/.env.local   # doplnit URL a publishable key ze Supabase
npm install
npm run dev                                     # http://localhost:3000
```

| Stránka | Co dělá |
| --- | --- |
| `/` | úvodní stránka |
| `/prihlaseni` | přihlášení a registrace účtu (potvrzení e-mailem přes `/auth/confirm`) |
| `/registrace-firmy` | založení firmy, údaje z ARES podle IČO |
| `/app` | přehled: zakázky tento týden, poptávky |
| `/app/zakazky` | seznam s hledáním a filtrem stavu, nová zakázka, úprava zakázky |
| `/app/klienti`, `/app/zamestnanci` | adresář klientů a lidé s nákladovými sazbami |
| `/app/cenik` | ceník prací a materiálu (nákup, prodej z přirážky, jednotka); položky se nemažou, jen skrývají. V zakázce se po napsání názvu doplní jednotka a ceny |
| `/app/moje-zakazky` | pracovník: jen přiřazené zakázky, bez cen |

Formulář zakázky počítá souhrn živě stejným jádrem `@iremeslo/core` jako testy; ukládá se jedním voláním
databázové funkce `save_job` (hlavička + všech pět sekcí v jedné transakci).

Písma (Inter, Archivo) jsou na vlastním serveru, bez Google Fonts.
