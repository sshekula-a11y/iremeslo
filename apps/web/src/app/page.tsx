import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const GDPR = [
  "Databáze běží v EU (Frankfurt), spojení je vždy šifrované.",
  "Data každé firmy jsou oddělená – nikdo cizí je nevidí.",
  "Žádné reklamní ani sledovací cookies, údaje neprodáváme.",
  "Na požádání vám data předáme nebo je smažeme.",
];

const benefits = [
  { title: "Nabídka za pár minut", text: "Práce, materiál, zaměstnanci a výdaje na jednom místě. Ceny z vašeho ceníku se doplní samy, PDF pošlete zákazníkovi rovnou ze stavby." },
  { title: "Vidíte skutečný zisk", text: "U každé zakázky náklady proti tomu, co fakturujete. Když marže klesne pod vaši hranici, aplikace upozorní." },
  { title: "Faktura podle zákona", text: "Plátce i neplátce DPH, 12 i 21 %, přenesená daňová povinnost, zálohy s daňovým dokladem a QR Platba. Čísla jdou po sobě bez mezer." },
];

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-12">
          <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-accent">
            30 dní zdarma, bez karty
          </p>
          <h1 className="max-w-2xl font-display text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-[46px]">
            Zakázky, nabídky a faktury pro řemeslníky. Z telefonu, přímo na stavbě.
          </h1>
          <p className="mt-4 max-w-xl text-[17px] text-white/75">
            Pro malíře, fasádníky, pokrývače, úklidové firmy, zahradníky a instalatéry. Od poptávky po zaplacení v jedné aplikaci.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/prihlaseni?rezim=registrace" className="btn-primary">
              Vyzkoušet zdarma
            </Link>
            <Link href="/jak-to-funguje" className="btn border border-white/20 text-white hover:bg-white/10">
              Jak to funguje
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 pt-12 sm:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="card p-5">
            <h2 className="font-display text-[18px] font-bold">
              {b.title}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{b.text}</p>
          </div>
        ))}
      </section>

      <p className="mx-auto max-w-5xl px-5 pt-5">
        <Link href="/jak-to-funguje" className="font-semibold text-accent-ink hover:underline">Podívejte se, jak to funguje krok za krokem →</Link>
      </p>

      <section className="mx-auto max-w-5xl px-5 py-12" aria-labelledby="gdpr">
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-ok-soft px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-ok">GDPR</span>
            <h2 id="gdpr" className="font-display text-[22px] font-extrabold">Vaše data jsou v bezpečí</h2>
          </div>
          <ul className="mt-4 grid gap-3 text-[15px] sm:grid-cols-2">
            {GDPR.map((g) => (
              <li key={g} className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-[12px] font-bold text-ok" aria-hidden="true">✓</span>
                {g}
              </li>
            ))}
          </ul>
          <Link href="/ochrana-osobnich-udaju" className="mt-4 inline-block font-semibold text-accent-ink hover:underline">Zásady ochrany osobních údajů →</Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
