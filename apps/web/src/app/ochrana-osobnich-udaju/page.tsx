import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { OPERATOR } from "@/lib/operator";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů (GDPR)",
  description: "Jak iRemeslo.cz zpracovává osobní údaje: co ukládáme, proč, komu je předáváme, jak dlouho a jaká máte práva.",
};

const UPDATED = "23. 11. 2026";

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />
      <article className="mx-auto max-w-3xl space-y-8 px-5 py-10 text-[16px] leading-relaxed">
        <header>
          <h1 className="font-display text-[32px] font-extrabold leading-tight">Ochrana osobních údajů</h1>
          <p className="mt-2 text-muted">Informace podle nařízení GDPR (EU 2016/679). Platné od {UPDATED}.</p>
        </header>

        <Part title="Kdo vaše údaje zpracovává">
          <p>
            Správcem osobních údajů je provozovatel platformy iRemeslo.cz: <strong>{OPERATOR.name}</strong>, IČO {OPERATOR.ico},
            DIČ {OPERATOR.dic}, se sídlem {OPERATOR.address}. Kontakt pro vše, co se týká osobních údajů:{" "}
            <a className="font-semibold text-accent-ink underline" href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
          </p>
        </Part>

        <Part title="Jaké údaje zpracováváme">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Účet:</strong> e-mail a heslo (ukládáme jen jeho zašifrovanou podobu, samotné heslo neznáme).</li>
            <li><strong>Firma:</strong> název, IČO, DIČ, adresa, kontakty, bankovní účet, logo, razítko a podpis.</li>
            <li><strong>Data, která do aplikace zadáte:</strong> zakázky, zákazníci, zaměstnanci a jejich sazby, ceník, nabídky a faktury.</li>
            <li><strong>Technické údaje:</strong> přihlašovací cookie, čas posledního přihlášení a záznamy o změnách dokladů; s vaším souhlasem také údaje o návštěvě webu z analytických a reklamních cookies.</li>
          </ul>
        </Part>

        <Part title="Proč a na jakém základě">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Provoz vašeho účtu a aplikace</strong> – plnění smlouvy (čl. 6 odst. 1 písm. b GDPR).</li>
            <li><strong>Účetnictví a daně</strong> u faktur za předplatné – zákonná povinnost (čl. 6 odst. 1 písm. c).</li>
            <li><strong>Bezpečnost a ochrana proti zneužití</strong>, např. jedno zkušební období na IČO – oprávněný zájem (čl. 6 odst. 1 písm. f).</li>
            <li><strong>Zveřejnění poptávky</strong> a předání kontaktu ověřeným řemeslníkům – souhlas zadavatele (čl. 6 odst. 1 písm. a).</li>
            <li><strong>Novinky e-mailem</strong> – jen pokud k tomu dáte souhlas; můžete ho kdykoli odvolat.</li>
          </ul>
          <p>Údaje neprodáváme a nepoužíváme k reklamě.</p>
        </Part>

        <Part id="poptavky" title="Veřejné poptávky">
          <p>
            Když zadáte poptávku, zpracováváme její obsah (obor, popis, rozsah, obec, PSČ, termín), vaši ulici a kontakt
            (jméno, telefon, e-mail). Popis, obec, PSČ a termín jsou veřejné. <strong>Jméno, telefon, e-mail a ulici
            zpřístupníme jen přihlášeným řemeslníkům s potvrzeným e-mailem a IČO ověřeným v ARES</strong>, aby vás mohli kvůli poptávce kontaktovat;
            každé zobrazení kontaktu zaznamenáváme.
          </p>
          <p>
            Právním základem je váš souhlas (čl. 6 odst. 1 písm. a GDPR), který můžete kdykoli odvolat uzavřením poptávky
            odkazem z e-mailu nebo napsáním na <a className="font-semibold text-accent-ink underline" href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
            Poptávka platí 60 dní. Nepotvrzené poptávky mažeme po 3 dnech, uzavřené a prošlé nejpozději 90 dní po jejich skončení.
          </p>
        </Part>

        <Part title="Údaje vašich zákazníků a zaměstnanců">
          <p>
            Údaje o vašich zákaznících a zaměstnancích, které do aplikace zadáte, spravujete vy – vaše firma je jejich správcem.
            My je pro vás pouze zpracováváme (jako zpracovatel podle čl. 28 GDPR): ukládáme je, zobrazujeme vám a vašim kolegům
            a použijeme je jen k provozu aplikace. Data každé firmy jsou v databázi oddělená a jiná firma k nim nemá přístup.
          </p>
        </Part>

        <Part title="Komu údaje předáváme">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Supabase</strong> – databáze, přihlašování a úložiště souborů; data jsou uložena v EU (Frankfurt).</li>
            <li><strong>Vercel</strong> – provoz webu a aplikace.</li>
            <li><strong>Resend</strong> – odesílání e-mailů z platformy (např. potvrzení e-mailu); servery v EU (Irsko).</li>
            <li><strong>Google, Seznam.cz a Meta</strong> – měření návštěvnosti a reklamy, jen pokud s cookies souhlasíte (viz Cookies).</li>
            <li><strong>ARES</strong> (Ministerstvo financí) – při zadání IČO se z veřejného rejstříku načtou údaje o firmě.</li>
          </ul>
          <p>
            S poskytovateli máme smlouvy o zpracování osobních údajů. Pokud by se údaje dostaly mimo EU, děje se tak na základě
            standardních smluvních doložek schválených Evropskou komisí.
          </p>
        </Part>

        <Part title="Jak dlouho údaje uchováváme">
          <p>
            Po dobu, kdy máte účet. Po jeho zrušení údaje smažeme nejpozději do 90 dnů, s výjimkou toho, co musíme uchovávat
            ze zákona (např. faktury za předplatné 10 let). Doklady, které v aplikaci vystavujete vy, jsou vaše – před zrušením
            účtu vám je na požádání předáme.
          </p>
        </Part>

        <Part id="cookies" title="Cookies">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Nezbytné</strong> – přihlášení, vybraná firma v aplikaci a uložení vaší volby cookies. Bez nich web nefunguje,
              souhlas se k nim nevyžaduje (§ 89 odst. 3 zákona č. 127/2005 Sb.).
            </li>
            <li>
              <strong>Analytické</strong> – Google Analytics (Google Ireland Ltd.) měří návštěvnost a používání webu. Jen s vaším souhlasem.
            </li>
            <li>
              <strong>Reklamní</strong> – Google Ads (Google Ireland Ltd.), Sklik (Seznam.cz, a.s.) a Meta (Meta Platforms Ireland Ltd.)
              měří výsledky reklamy a pomáhají s jejím cílením. Jen s vaším souhlasem.
            </li>
          </ul>
          <p>
            Analytické a reklamní značky načítáme přes Google Tag Manager až poté, co souhlas udělíte. Právním základem je váš
            souhlas (čl. 6 odst. 1 písm. a GDPR). Kontaktní údaje ani obsah vašich zakázek, dokladů a poptávek těmto systémům
            neposíláme; na stránkách s tajnými odkazy (správa poptávky, potvrzení e-mailu) a v administraci se značky nenačítají.
            Společnosti Google a Meta mohou údaje zpracovávat i v USA, a to na základě rámce EU–USA pro ochranu osobních údajů
            (Data Privacy Framework) a standardních smluvních doložek.
          </p>
          <p>
            Vaši volbu si pamatuje prohlížeč po dobu 12 měsíců, pak se zeptáme znovu. Souhlas můžete kdykoli změnit nebo odvolat:{" "}
            <CookieSettingsLink className="font-semibold text-accent-ink underline">Nastavení cookies</CookieSettingsLink>.
            Po odvolání značky vypneme a jejich cookies smažeme.
          </p>
        </Part>

        <Part title="Zabezpečení">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Spojení s webem je vždy šifrované (HTTPS) a hesla ukládáme pouze v zašifrované podobě.</li>
            <li>Data jednotlivých firem odděluje přímo databáze; pracovník firmy nevidí ceny ani zisk.</li>
            <li>Do vašich zakázek a dokladů provozovatel nenahlíží. Podporu poskytujeme jen na vaši žádost a každý zásah zaznamenáváme.</li>
          </ul>
        </Part>

        <Part title="Vaše práva">
          <p>Máte právo:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>na přístup ke svým údajům a jejich kopii,</li>
            <li>na opravu nepřesných údajů a na výmaz („být zapomenut“),</li>
            <li>na omezení zpracování a na přenositelnost údajů,</li>
            <li>vznést námitku proti zpracování z oprávněného zájmu a kdykoli odvolat souhlas,</li>
            <li>podat stížnost u Úřadu pro ochranu osobních údajů (<a className="text-accent-ink underline" href="https://uoou.gov.cz" rel="noreferrer" target="_blank">uoou.gov.cz</a>).</li>
          </ul>
          <p>
            Stačí napsat na <a className="font-semibold text-accent-ink underline" href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
            Odpovíme nejpozději do 30 dnů.
          </p>
        </Part>

        <p className="border-t border-line pt-6 text-[14px] text-muted">
          <Link href="/obchodni-podminky" className="text-accent-ink underline">Obchodní podmínky</Link>
          {" · "}
          <Link href="/" className="text-accent-ink underline">Zpět na úvod</Link>
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}

function Part({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="font-display text-[22px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}
