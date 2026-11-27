import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { SECURITY } from "@/lib/marketing";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = {
  title: "Bezpečnost dat",
  description: "Kde jsou vaše zakázky a faktury uložené, kdo k nim má přístup a jak si data kdykoli odnesete. Data v EU, každá firma zvlášť.",
  alternates: { canonical: "/bezpecnost-dat" },
};

const PROCESSORS = [
  ["Supabase", "databáze, přihlašování a soubory – datové centrum ve Frankfurtu (EU)"],
  ["Vercel", "provoz webu a aplikace"],
  ["Resend", "odesílání e-mailů z platformy – servery v Irsku (EU)"],
];

export default function SecurityPage() {
  return (
    <main>
      <JsonLd trail={[["Bezpečnost dat", "/bezpecnost-dat"]]} />
      <SiteHeader />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-10 pt-8 sm:pt-12">
          <h1 className="font-display text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-[44px]">Bezpečnost dat</h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-white/80">
            Svěřujete nám zakázky, ceny a faktury. Tady je přehledně, kde jsou uložené, kdo k nim má přístup a jak si je kdykoli odnesete.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY.map((s) => (
            <li key={s.title} className="card p-5">
              <h2 className="font-display text-[18px] font-bold">{s.title}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ul>

        <section className="card mt-8 p-5 sm:p-6" aria-labelledby="kdo">
          <h2 id="kdo" className="font-display text-[20px] font-extrabold">Kdo data zpracovává</h2>
          <p className="mt-1 text-[15px] text-muted">Provozovatel: {OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.address}. Technické služby, které používáme:</p>
          <ul className="mt-3 space-y-1.5 text-[15px]">
            {PROCESSORS.map(([n, t]) => <li key={n}><strong>{n}</strong> – {t}</li>)}
          </ul>
        </section>

        <section className="card mt-4 p-5 sm:p-6" aria-labelledby="konec">
          <h2 id="konec" className="font-display text-[20px] font-extrabold">Když skončíte</h2>
          <p className="mt-2 text-[15px] leading-relaxed">
            Po skončení předplatného máte 30 dní na stažení dokladů a dat. Potom je smažeme, kromě údajů, které musíme uchovat podle zákona.
            Podrobnosti jsou v <Link href="/obchodni-podminky" className="font-semibold text-accent-ink underline">obchodních podmínkách</Link> a{" "}
            <Link href="/ochrana-osobnich-udaju" className="font-semibold text-accent-ink underline">zásadách ochrany osobních údajů</Link>.
          </p>
          <p className="mt-3 text-[15px]">
            Máte otázku k bezpečnosti? <Link href="/kontakt" className="font-semibold text-accent-ink underline">Napište nám</Link>.
          </p>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
