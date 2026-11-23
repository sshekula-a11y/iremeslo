# E-maily iRemeslo.cz

Potvrzovací e-maily **neposílá Supabase Auth**, ale přímo databáze přes [Resend](https://resend.com)
(migrace `010_email.sql`). Nastavení Supabase „Confirm email“, „Site URL“ ani SMTP se proto nepoužívá.

## Jak to funguje

1. Registrace (`signup_with_password`) založí účet, člověka hned přihlásí a zapíše ho do `app.unverified_users`.
2. Databáze pošle český e-mail s logem a odkazem `https://www.iremeslo.cz/overeni?t=…` (adresa z /ssh → E-maily) (platí 48 hodin).
   Ukládá se jen sha256 tokenu.
3. Dokud e-mail není potvrzený, v aplikaci svítí pruh „Potvrďte svůj e-mail“ s tlačítkem „Poslat znovu“
   (nejdřív za 2 minuty, nejvýš 5× denně). Nabídky jdou, **faktury a zálohy ne**.
4. Nepotvrzené účty bez firmy maže každou noc pg_cron (`iremeslo-cleanup-unverified`, 3:17 UTC) po 7 dnech.
5. Účty založené před migrací 010 platí jako potvrzené.

## Nastavení (jednou)

1. **resend.com** → účet → *Domains* → *Add domain* `iremeslo.cz`, region **EU (Ireland)**.
2. DNS záznamy, které Resend ukáže (TXT pro DKIM, MX + TXT pro SPF na subdoméně `send`), přidat u registrátora domény.
   Případný DMARC: TXT `_dmarc` → `v=DMARC1; p=none;`. Počkat, až Resend ukáže *Verified*.
3. *API Keys* → *Create API key* (oprávnění *Sending access*, doména iremeslo.cz).
4. **iremeslo.cz/ssh → E-maily** → vložit klíč → *Uložit*. Klíč se uloží do Supabase Vault a už se nikde nezobrazí.
   Klíč nikdy nepatří do chatu, kódu ani proměnných prostředí.
5. Tamtéž *Poslat zkušební e-mail* a v logu zkontrolovat „doručeno do Resend“.

Šablona `potvrzeni-registrace.html` je jen archiv původní šablony pro Supabase Auth; aktuální podoba e-mailu je ve funkcích
`app.email_layout` a `app.start_verification`.
