import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

/** Patička veřejného webu: provozovatel, obchodní podmínky, GDPR a kontakt. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-6 text-[13px] text-muted">
        <p>© 2026 iRemeslo.cz · {OPERATOR.name}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Patička">
          <Link href="/jak-to-funguje" className="hover:text-ink">Jak to funguje</Link>
          <Link href="/obchodni-podminky" className="hover:text-ink">Obchodní podmínky</Link>
          <Link href="/ochrana-osobnich-udaju" className="hover:text-ink">Ochrana osobních údajů (GDPR)</Link>
          <a href={`mailto:${OPERATOR.email}`} className="hover:text-ink">{OPERATOR.email}</a>
        </nav>
      </div>
    </footer>
  );
}
