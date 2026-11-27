import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PLANS, PRICE_FROM, kc } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Ceník",
  description: `30 dní zdarma bez platební karty, pak od ${PRICE_FROM} Kč měsíčně bez DPH. Všechny funkce v každém tarifu, platba převodem na fakturu, zrušení kdykoli.`,
  alternates: { canonical: "/cenik" },
};

/** Co je v ceně – jen funkce, které aplikace opravdu má (stejné ve všech tarifech). */
const FEATURES = [
  "Zakázky s výpočtem nákladů, zisku a marže",
  "Cenové nabídky v PDF s vaším logem",
  "Faktury, zálohové faktury, daňové doklady k platbě a opravné doklady",
  "Export faktur pro účetní v ZIP (PDF + ISDOC) a převzetí faktur z jiného programu",
  "Smlouva o dílo, dodatek, předávací protokol, dodací list a reklamační protokol",
  "Podpis prstem na místě i na dálku přes odkaz",
  "Upomínky, předžalobní výzvy a pokladní doklady",
  "Kalendář a harmonogram prací",
  "Zákazníci s načtením z ARES, import a export kontaktů (vCard, Excel), ceník prací a materiálu",
  "Zaměstnanci s vlastními právy (pracovník nevidí ceny ani zisk)",
  "Kontakty z veřejných poptávek (pro firmy s IČO ověřeným v ARES, až 50 denně)",
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Co se stane po 30 dnech zdarma?",
    a: "Nic automaticky. Zkušební období se samo nezmění v placené a nic vám neúčtujeme. Pokud nepokračujete, účet přejde do režimu jen pro čtení – data uvidíte a stáhnete, nové doklady ale nevystavíte.",
  },
  {
    q: "Jak zaplatím?",
    a: <><Link href="/kontakt?tema=predplatne" className="font-semibold text-accent-ink underline">Napište nám</Link>, jaký tarif a období chcete. Pošleme fakturu a zaplatíte převodem předem. Platební kartu nepotřebujete.</>,
  },
  {
    q: "Platím něco navíc?",
    a: "Ne. Za doklady, zakázky ani kontakty z poptávek se nic nepřiplácí. Ceny jsou bez DPH, DPH se připočte v zákonné výši.",
  },
  {
    q: "Můžu předplatné zrušit?",
    a: <>Kdykoli – stačí nám <Link href="/kontakt?tema=predplatne" className="font-semibold text-accent-ink underline">napsat</Link>. Služba poběží do konce zaplaceného období. Potom máte ještě 30 dní na stažení dokladů a dat, pak je smažeme (kromě údajů, které musíme uchovat podle zákona).</>,
  },
  {
    q: "Co když nás bude víc než 5?",
    a: "Přejdete na tarif Bez limitu – počet uživatelů ve firmě pak není omezený. Do počtu se počítají všichni, kdo mají ve firmě účet (majitel, kancelář i pracovníci).",
  },
  {
    q: "Platí zákazníci za zadání poptávky?",
    a: "Ne. Zadání poptávky je pro zákazníky vždy zdarma a bez registrace. Platí jen řemeslníci za aplikaci.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <SiteHeader current="cenik" />

      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <h1 className="font-display text-[32px] font-extrabold leading-tight sm:text-[40px]">Ceník</h1>
        <p className="mt-2 max-w-2xl text-[17px] text-muted">
          30 dní zdarma bez platební karty, pak od <strong className="text-ink">{PRICE_FROM} Kč měsíčně</strong> bez DPH.
          Všechny funkce máte v každém tarifu – liší se jen počtem uživatelů.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const trial = p.id === "zkusebni";
            const saving = p.month && p.year ? p.month * 12 - p.year : 0;
            return (
              <section key={p.id} aria-labelledby={`plan-${p.id}`}
                className={`card flex flex-col p-5 sm:p-6 ${trial ? "border-accent ring-1 ring-accent" : ""}`}>
                <h2 id={`plan-${p.id}`} className="font-display text-[20px] font-extrabold">{p.name}</h2>
                <p className="text-[14px] text-muted">{p.note}</p>
                <p className="mt-4">
                  <span className="num font-display text-[36px] font-extrabold leading-none">{kc(p.month ?? 0)}&nbsp;Kč</span>
                  <span className="ml-1 text-[15px] text-muted">{trial ? "na 30 dní" : "měsíčně"}</span>
                </p>
                <p className="num mt-1 min-h-5 text-[14px] text-muted">
                  {p.year ? <>nebo {kc(p.year)}&nbsp;Kč ročně{saving > 0 && <> – ušetříte {kc(saving)}&nbsp;Kč</>}</> : "bez DPH"}
                </p>
                <ul className="mt-4 space-y-1.5 text-[15px]">
                  <Li>Uživatelé: {p.users}</Li>
                  <Li>Všechny funkce</Li>
                  <Li>{trial ? "Bez platební karty a bez závazků" : "Platba převodem na fakturu"}</Li>
                </ul>
                <div className="mt-auto pt-5">
                  <Link href="/prihlaseni?rezim=registrace" className={`${trial ? "btn-primary" : "btn-ghost"} w-full`}>
                    {trial ? "Vyzkoušet 30 dní zdarma" : "Začít zkušebním obdobím"}
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Ceny jsou bez DPH. Zkušební období platí jednou pro každé IČO. Podrobnosti v <Link href="/obchodni-podminky" className="underline">obchodních podmínkách</Link> (čl. 3, 4 a 9).
        </p>

        <section className="mt-12" aria-labelledby="v-cene">
          <h2 id="v-cene" className="font-display text-[24px] font-extrabold">Co je v ceně</h2>
          <ul className="mt-4 grid gap-x-8 gap-y-2 text-[16px] sm:grid-cols-2">
            {FEATURES.map((f) => <Li key={f}>{f}</Li>)}
          </ul>
          <Link href="/jak-to-funguje" className="mt-4 inline-block font-semibold text-accent-ink underline">Ukázky z aplikace →</Link>
        </section>

        <section className="mt-12" aria-labelledby="otazky">
          <h2 id="otazky" className="font-display text-[24px] font-extrabold">Časté otázky k platbám</h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-4 sm:px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  {f.q}
                  <span aria-hidden="true" className="text-[20px] text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <aside className="card mt-12 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <p className="text-[16px]"><strong>Hledáte řemeslníka?</strong> Zadání poptávky je zdarma a bez registrace.</p>
          <Link href="/poptavky/nova" className="btn-dark">Zadat poptávku</Link>
        </aside>
      </div>

      <SiteFooter />
    </main>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <svg className="mt-1 shrink-0 text-ok" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
