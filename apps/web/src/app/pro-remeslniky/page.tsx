import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { SOFTWARE_APP } from "@/lib/seo";
import { FaqList } from "@/components/FaqList";
import { FAQ_TRADESMEN } from "@/lib/faq";
import { FEATURES, TRADESMAN_STEPS as STEPS, TRUST } from "@/lib/marketing";
import { PRICE_FROM } from "@/lib/pricing";
import { LANDINGS } from "@/lib/landings";

export const metadata: Metadata = {
  title: "Program pro řemeslníky – zakázky, nabídky, faktury",
  description: `Poptávky od zákazníků, kalkulace s marží, nabídky v PDF, faktury, smlouvy s podpisem prstem a kalendář. 30 dní zdarma, pak od ${PRICE_FROM} Kč měsíčně.`,
  alternates: { canonical: "/pro-remeslniky" },
};

const SHOTS = [
  { src: "/jak-to-funguje/zakazka-pocitac.webp", alt: "Zakázka na počítači: práce, materiál a souhrn s náklady a marží", width: 1600, height: 1112, caption: "Zakázka s výpočtem marže" },
  { src: "/jak-to-funguje/nabidka.webp", alt: "Cenová nabídka v PDF s položkami a součtem s DPH", width: 1240, height: 1753, caption: "Cenová nabídka v PDF" },
  { src: "/jak-to-funguje/kalendar-pocitac.webp", alt: "Měsíční kalendář zakázek s barvami podle stavu", width: 1600, height: 1112, caption: "Kalendář zakázek" },
];

const FAQ_PICK = ["Jak získám nové zakázky?", "Kolik to stojí?", "Co obsahuje bezplatné období?", "Funguje to na mobilu?"];

export default function TradesmenPage() {
  const faq = FAQ_TRADESMEN.filter((f) => FAQ_PICK.includes(f.q));
  return (
    <main>
      <JsonLd trail={[["Pro řemeslníky", "/pro-remeslniky"]]} nodes={[SOFTWARE_APP]} />
      <SiteHeader current="pro-remeslniky" />

      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-12 pt-10 sm:pt-14">
          <p className="text-[13px] font-bold uppercase tracking-wider text-accent">Pro řemeslníky</p>
          <h1 className="mt-2 max-w-3xl font-display text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-[48px]">
            Více zakázek. <span className="text-accent">Méně administrativy.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/80 sm:text-[19px]">
            iRemeslo.cz je virtuální kancelář pro vaši firmu: poptávky od zákazníků, kalkulace, cenové nabídky, faktury,
            smlouvy o dílo a další listiny s podpisem prstem i kalendář – vše na jednom místě, na telefonu i na počítači.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/prihlaseni?rezim=registrace" className="btn-primary">Vyzkoušet 30 dní zdarma</Link>
            <Link href="/poptavky" className="btn border border-white/20 text-white hover:bg-white/10">Prohlédnout poptávky</Link>
          </div>
          <p className="mt-4 text-[14px] text-white/60">Bez platební karty · pak od {PRICE_FROM} Kč měsíčně bez DPH</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5">
        <section className="pt-12" aria-labelledby="funkce">
          <h2 id="funkce" className="font-display text-[26px] font-extrabold">Vše pro vaše řemeslo na jednom místě</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5">
                <h3 className="font-display text-[18px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-12" aria-labelledby="ukazky">
          <h2 id="ukazky" className="font-display text-[26px] font-extrabold">Ukázky z aplikace</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {SHOTS.map((s) => (
              <figure key={s.src} className="card overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden border-b border-line bg-paper">
                  <Image src={s.src} alt={s.alt} width={s.width} height={s.height} sizes="(min-width: 768px) 320px, 100vw" className="h-full w-full object-cover object-top" />
                </div>
                <figcaption className="px-4 py-3 text-[14px] font-semibold">{s.caption}</figcaption>
              </figure>
            ))}
          </div>
          <Link href="/jak-to-funguje" className="mt-4 inline-block font-semibold text-accent-ink underline">Jak to funguje krok za krokem →</Link>
        </section>

        <section className="pt-12" aria-labelledby="zacatek">
          <h2 id="zacatek" className="font-display text-[26px] font-extrabold">Jak začít</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-5">
                <span className="num flex size-8 items-center justify-center rounded-full bg-accent font-bold text-ink" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-3 font-display text-[17px] font-bold leading-snug">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4 pt-12 md:grid-cols-2" aria-label="Cena a důvěra">
          <div className="card flex flex-col p-5 sm:p-6">
            <h2 className="font-display text-[22px] font-extrabold">Cena</h2>
            <p className="mt-2 text-[16px]">
              <strong>30 dní zdarma</strong>, pak od <strong className="num">{PRICE_FROM} Kč</strong> měsíčně bez DPH.
              Všechny funkce v každém tarifu, platba převodem na fakturu, zrušení kdykoli.
            </p>
            <div className="mt-auto pt-4"><Link href="/cenik" className="btn-ghost">Zobrazit ceník</Link></div>
          </div>
          <div className="card p-5 sm:p-6">
            <h2 className="font-display text-[22px] font-extrabold">Komu svěřujete data</h2>
            <ul className="mt-2 space-y-1.5 text-[15px]">
              {TRUST.map((t) => <li key={t} className="flex gap-2"><span className="text-ok" aria-hidden="true">✓</span><span>{t}</span></li>)}
            </ul>
            <Link href="/bezpecnost-dat" className="mt-3 inline-block text-[14px] font-semibold text-accent-ink underline">Bezpečnost dat →</Link>
          </div>
        </section>

        <nav className="pt-12" aria-labelledby="podle-oboru">
          <h2 id="podle-oboru" className="font-display text-[22px] font-extrabold">Podle toho, co potřebujete</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {LANDINGS.map((l) => (
              <li key={l.slug}><Link href={`/${l.slug}`} className="inline-block rounded-full border border-line bg-white px-3.5 py-2 text-[14px] font-semibold hover:border-ink/30">{l.name}</Link></li>
            ))}
          </ul>
        </nav>

        <section className="pt-12" aria-labelledby="otazky">
          <h2 id="otazky" className="mb-3 font-display text-[26px] font-extrabold">Časté otázky</h2>
          <FaqList items={faq} />
          <Link href="/caste-otazky#remeslnici" className="mt-3 inline-block font-semibold text-accent-ink underline">Všechny otázky →</Link>
        </section>

        <aside className="card my-12 flex flex-wrap items-center justify-between gap-4 bg-accent-soft p-5 sm:p-6">
          <p className="text-[17px]"><strong>Vyzkoušejte iRemeslo.cz 30 dní zdarma.</strong> Bez platební karty, začátek za pár minut.</p>
          <Link href="/prihlaseni?rezim=registrace" className="btn-primary">Vyzkoušet zdarma</Link>
        </aside>
      </div>

      <SiteFooter />
    </main>
  );
}
