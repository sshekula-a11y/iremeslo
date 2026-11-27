import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FaqList } from "@/components/FaqList";
import { FAQ_CUSTOMERS, FAQ_TRADESMEN, faqJsonLd } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Časté otázky",
  description: "Odpovědi pro zákazníky (zadání poptávky zdarma, kdo vidí kontakt) i pro řemeslníky (cena, zkušební období, faktury, smlouva o dílo).",
  alternates: { canonical: "/caste-otazky" },
};

export default function FaqPage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd([...FAQ_CUSTOMERS, ...FAQ_TRADESMEN])) }} />
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <h1 className="font-display text-[32px] font-extrabold leading-tight sm:text-[40px]">Časté otázky</h1>
        <nav className="mt-4 flex flex-wrap gap-2 text-[15px] font-semibold" aria-label="Skupiny otázek">
          <a href="#zakaznici" className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink/30">Pro zákazníky</a>
          <a href="#remeslnici" className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink/30">Pro řemeslníky</a>
        </nav>

        <section id="zakaznici" className="mt-8 scroll-mt-4" aria-labelledby="h-zakaznici">
          <h2 id="h-zakaznici" className="mb-3 font-display text-[22px] font-extrabold">Pro zákazníky</h2>
          <FaqList items={FAQ_CUSTOMERS} />
          <Link href="/poptavky/nova" className="btn-primary mt-4">Zadat poptávku zdarma</Link>
        </section>

        <section id="remeslnici" className="mt-12 scroll-mt-4" aria-labelledby="h-remeslnici">
          <h2 id="h-remeslnici" className="mb-3 font-display text-[22px] font-extrabold">Pro řemeslníky</h2>
          <FaqList items={FAQ_TRADESMEN} />
          <Link href="/prihlaseni?rezim=registrace" className="btn-dark mt-4">Vyzkoušet 30 dní zdarma</Link>
        </section>

        <p className="mt-12 text-[15px] text-muted">
          Nenašli jste odpověď?{" "}
          <Link href="/kontakt" className="font-semibold text-accent-ink underline">Napište nám</Link> – odpovídáme obvykle do jednoho pracovního dne.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
