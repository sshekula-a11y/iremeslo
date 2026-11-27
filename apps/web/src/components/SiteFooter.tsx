import Link from "next/link";
import { OPERATOR } from "@/lib/operator";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";

const link = "hover:text-ink hover:underline";

/** Patička veřejného webu: čtyři sloupce (zákazníci, řemeslníci, podpora, právní); údaje o provozovateli jsou na stránce Kontakt. */
export function SiteFooter() {
  return (
    <footer data-place="paticka" className="mt-4 border-t border-line bg-white">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-7 px-5 py-8 text-[14px] text-muted md:grid-cols-4">
        <Col title="Pro zákazníky">
          <Link href="/poptavky/nova" className={link}>Zadat poptávku zdarma</Link>
          <Link href="/poptavky" className={link}>Všechny poptávky</Link>
          <Link href="/remeslnici" className={link}>Řemeslníci podle oboru</Link>
          <Link href="/remeslnici/instalater" className={link}>Instalatér</Link>
          <Link href="/remeslnici/elektrikar" className={link}>Elektrikář</Link>
          <Link href="/remeslnici/malir" className={link}>Malíř pokojů</Link>
          <Link href="/remeslnici/rekonstrukce-bytu" className={link}>Rekonstrukce bytu</Link>
        </Col>
        <Col title="Pro řemeslníky">
          <Link href="/pro-remeslniky" className={link}>Funkce aplikace</Link>
          <Link href="/poptavky" className={link}>Poptávky</Link>
          <Link href="/cenik" className={link}>Ceník</Link>
          <Link href="/prihlaseni?rezim=registrace" className={link}>Vyzkoušet 30 dní zdarma</Link>
        </Col>
        <Col title="Podpora">
          <Link href="/caste-otazky" className={link}>Časté otázky</Link>
          <Link href="/jak-to-funguje" className={link}>Jak to funguje</Link>
          <Link href="/kontakt" className={link}>Kontakt</Link>
          <a href={`mailto:${OPERATOR.email}`} className={link}>{OPERATOR.email}</a>
        </Col>
        <Col title="Právní">
          <Link href="/obchodni-podminky" className={link}>Obchodní podmínky</Link>
          <Link href="/ochrana-osobnich-udaju" className={link}>Ochrana osobních údajů</Link>
          <CookieSettingsLink className={`text-left ${link}`} />
        </Col>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-5xl px-5 py-4 text-[13px] text-muted">
          © 2026 iRemeslo.cz · <Link href="/kontakt" className={link}>Kontakt a provozovatel</Link>
        </p>
      </div>
    </footer>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2.5 font-display text-[14px] font-bold text-ink">{title}</h2>
      <div className="flex flex-col items-start gap-2">{children}</div>
    </div>
  );
}
