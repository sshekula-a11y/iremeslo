# E-maily z přihlašování (Supabase Auth)

Supabase posílá potvrzení registrace sám. Výchozí e-mail je anglicky a odkaz vede přes servery Supabase
na adresu z nastavení „Site URL“. Tady je česká šablona, jejíž odkaz vede rovnou na `/auth/confirm` v aplikaci.

## 1. Adresa webu (bez toho odkaz skončí na „stránka nenalezena“)

Supabase → **Authentication → URL Configuration**
- **Site URL:** `https://iremeslo.cz` (nebo adresa z Vercelu, dokud doména neběží)
- **Redirect URLs:** `https://iremeslo.cz/**`, `https://www.iremeslo.cz/**` a pro náhledy `https://*.vercel.app/**`

## 2. Česká šablona

Supabase → **Authentication → Emails → Templates → Confirm signup**
- **Subject:** `Potvrďte registraci na iRemeslo.cz`
- **Message body:** obsah souboru `potvrzeni-registrace.html`

## 3. Odesílatel info@iremeslo.cz (doporučeno)

Vestavěné odesílání Supabase je jen na zkoušku: posílá z cizí adresy a jen pár e-mailů za hodinu.
Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**
- **Sender email:** `info@iremeslo.cz`, **Sender name:** `iRemeslo.cz`
- **Host, Port, Username, Password:** SMTP údaje od poskytovatele schránky info@iremeslo.cz
