import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Napište nám na info@iremeslo.cz – s aplikací, poptávkou i předplatným poradíme. Údaje o provozovateli iRemeslo.cz.",
  alternates: { canonical: "/kontakt" },
};

/** Kontakt a údaje o provozovateli (zákon č. 480/2004 Sb. – identifikace poskytovatele služby). */
export default function ContactPage() {
  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        <div>
          <h1 className="font-display text-[30px] font-extrabold leading-tight">Kontakt</h1>
          <p className="mt-2 text-[17px] text-muted">Rádi poradíme s aplikací, poptávkou i předplatným. Odpovídáme obvykle do jednoho pracovního dne.</p>
        </div>

        <section className="card p-5 sm:p-6" aria-labelledby="napiste">
          <h2 id="napiste" className="font-display text-[20px] font-extrabold">Napište nám</h2>
          <a href={`mailto:${OPERATOR.email}`} className="mt-2 inline-block break-all font-display text-[22px] font-bold text-accent-ink underline">{OPERATOR.email}</a>
          <ul className="mt-4 space-y-1.5 text-[15px] text-muted">
            <li><strong className="text-ink">Řemeslníci:</strong> registrace, předplatné, faktury za aplikaci, převod dat z jiného programu.</li>
            <li><strong className="text-ink">Zákazníci:</strong> zadaná poptávka, nabídky od řemeslníků, smazání údajů.</li>
          </ul>
          <p className="mt-4 text-[14px] text-muted">Nejčastější dotazy najdete i v <Link href="/caste-otazky" className="font-semibold text-accent-ink underline">častých otázkách</Link>.</p>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="provozovatel">
          <h2 id="provozovatel" className="font-display text-[20px] font-extrabold">Provozovatel</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">Společnost</dt><dd className="font-semibold">{OPERATOR.name}</dd>
            <dt className="text-muted">IČO</dt><dd className="num">{OPERATOR.ico}</dd>
            <dt className="text-muted">DIČ</dt><dd className="num">{OPERATOR.dic}</dd>
            <dt className="text-muted">Sídlo</dt><dd>{OPERATOR.address}</dd>
            <dt className="text-muted">E-mail</dt><dd><a href={`mailto:${OPERATOR.email}`} className="text-accent-ink underline">{OPERATOR.email}</a></dd>
          </dl>
          <p className="mt-4 text-[14px] text-muted">
            Podmínky používání najdete v <Link href="/obchodni-podminky" className="font-semibold text-accent-ink underline">obchodních podmínkách</Link>,
            zpracování osobních údajů v <Link href="/ochrana-osobnich-udaju" className="font-semibold text-accent-ink underline">zásadách ochrany osobních údajů</Link>.
          </p>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
