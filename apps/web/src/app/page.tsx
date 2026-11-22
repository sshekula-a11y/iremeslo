import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const benefits = [
  { title: "Nabídka za pár minut", text: "Práce, materiál, lidé a výdaje na jednom místě. Ceny z vašeho ceníku se doplní samy, PDF pošlete zákazníkovi rovnou ze stavby." },
  { title: "Vidíte skutečný zisk", text: "U každé zakázky náklady proti tomu, co fakturujete. Když marže klesne pod vaši hranici, aplikace upozorní." },
  { title: "Faktura podle zákona", soon: true, text: "Plátce i neplátce DPH, 12 i 21 %, přenesená daňová povinnost, zálohy a QR platba. Čísla jdou po sobě bez mezer." },
];

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-12">
          <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-accent">
            Beta – zatím úplně zdarma
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
              {"soon" in b && b.soon && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-[12px] font-semibold text-accent-ink">Připravujeme</span>}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{b.text}</p>
          </div>
        ))}
      </section>

      <p className="mx-auto max-w-5xl px-5 pb-12 pt-5">
        <Link href="/jak-to-funguje" className="font-semibold text-accent-ink hover:underline">Podívejte se, jak to funguje krok za krokem →</Link>
      </p>

      <footer className="mx-auto max-w-5xl px-5 pb-10 text-[13px] text-muted">© 2026 iRemeslo.cz · Řemeslná práce pod kontrolou</footer>
    </main>
  );
}
