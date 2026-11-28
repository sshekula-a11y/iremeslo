import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { summarizeJob, formatPercent, type Job } from "@iremeslo/core";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import { LANDINGS, getLanding, type LandingExample } from "@/lib/landings";
import { SOFTWARE_APP } from "@/lib/seo";
import { CATEGORY_LABEL } from "@/lib/inquiries";

/** Jen stránky ze seznamu – jiné adresy na této úrovni vrátí 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return LANDINGS.map((l) => ({ landing: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[landing]">): Promise<Metadata> {
  const l = getLanding((await params).landing);
  if (!l) return {};
  return { title: { absolute: l.metaTitle }, description: l.metaDescription, alternates: { canonical: `/${l.slug}` } };
}

const SHOTS = {
  zakazka: { src: "/jak-to-funguje/zakazka-telefon.webp", alt: "Zakázka na telefonu: materiál a souhrn s náklady, výdělkem a marží", w: 780, h: 1688, phone: true, caption: "Kalkulace zakázky na telefonu" },
  nabidka: { src: "/jak-to-funguje/nabidka.webp", alt: "Cenová nabídka v PDF s položkami a součtem s DPH", w: 1240, h: 1753, phone: false, caption: "Nabídka, kterou dostane zákazník" },
  kalendar: { src: "/jak-to-funguje/kalendar-telefon.webp", alt: "Kalendář zakázek na telefonu jako seznam dní", w: 780, h: 1688, phone: true, caption: "Kalendář zakázek na telefonu" },
} as const;

const h = (n: number) => Math.round(n * 100);
/** Celé koruny s mezerou mezi tisíci: 4520000 → „45 200 Kč“. */
const kc = (hundredths: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(hundredths / 100))} Kč`;

function compute(e: LandingExample) {
  const job: Job = {
    work: e.work.map((w) => ({ description: w.description, qty: h(w.qty), unit: w.unit, unitPrice: h(w.unitPrice) })),
    materials: e.materials.map((m) => ({ description: m.description, qtyPlanned: h(m.qty), unit: m.unit, purchasePrice: h(m.purchasePrice), salePrice: h(m.salePrice), billable: true })),
    labor: e.labor.map((l) => ({ name: l.name, qtyPlanned: h(l.qty), unit: l.unit, rate: h(l.rate) })),
    expenses: e.expenses.map((x) => ({ description: x.description, qtyPlanned: h(x.qty), unitPrice: h(x.unitPrice) })),
    vatMode: e.vatMode, vatRate: e.vatRate,
  };
  return summarizeJob(job);
}

export default async function LandingPage({ params }: PageProps<"/[landing]">) {
  const l = getLanding((await params).landing);
  if (!l) notFound();
  const s = l.example ? compute(l.example) : null;
  const others = LANDINGS.filter((x) => x.slug !== l.slug);

  return (
    <main>
      <JsonLd trail={[["Pro řemeslníky", "/pro-remeslniky"], [l.name, `/${l.slug}`]]} nodes={[SOFTWARE_APP, {
        "@type": "FAQPage", mainEntity: l.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }]} />
      <SiteHeader current="pro-remeslniky" />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:pb-14 sm:pt-8">
          <nav aria-label="Drobečková navigace" className="text-[13px] text-white/60">
            <Link href="/" className="hover:text-white">Úvod</Link> › <Link href="/pro-remeslniky" className="hover:text-white">Pro řemeslníky</Link> › <span className="text-white/85">{l.name}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-display text-[31px] font-extrabold leading-[1.1] tracking-tight min-[390px]:text-[34px] sm:text-[46px]">
            {l.h1} <span className="text-accent">{l.h1Accent}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/80">{l.intro}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/prihlaseni?rezim=registrace" className="btn-primary">Vyzkoušet 30 dní zdarma</Link>
            <Link href="/jak-to-funguje" className="btn border border-white/20 text-white hover:bg-white/10">Jak to funguje</Link>
          </div>
          <p className="mt-3 text-[14px] text-white/60">Bez platební karty · pak od 199 Kč měsíčně bez DPH · zrušení kdykoli</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5">
        <section className="pt-12" aria-labelledby="znate">
          <h2 id="znate" className="font-display text-[26px] font-extrabold sm:text-[30px]">Znáte to?</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {l.pains.map((p) => (
              <li key={p.title} className="card p-5">
                <h3 className="font-display text-[18px] font-bold">{p.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="pt-12" aria-labelledby="umi">
          <h2 id="umi" className="font-display text-[26px] font-extrabold sm:text-[30px]">Co s iRemeslo.cz vyřešíte</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {l.features.map((f) => (
              <li key={f.title} className="card p-5">
                <h3 className="font-display text-[18px] font-bold"><span className="text-ok" aria-hidden="true">✓ </span>{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {l.example && s && (
          <section className="pt-12" aria-labelledby="priklad">
            <h2 id="priklad" className="font-display text-[26px] font-extrabold sm:text-[30px]">{l.example.title}</h2>
            <p className="mt-1 text-[15px] text-muted">{l.example.note}</p>
            <div className="card mt-5 grid gap-0 overflow-hidden md:grid-cols-[1fr_18rem]">
              <div className="min-w-0 divide-y divide-line">
                <Rows label="Práce" rows={l.example.work.map((w) => [w.description, `${fmtQty(w.qty)} ${w.unit} × ${kc(h(w.unitPrice))}`])} />
                <Rows label="Materiál (účtovaný zákazníkovi)" rows={l.example.materials.map((m) => [m.description, `${fmtQty(m.qty)} ${m.unit} · nákup ${kc(h(m.purchasePrice))}, prodej ${kc(h(m.salePrice))}`])} />
                <Rows label="Lidé (náklad)" rows={l.example.labor.map((x) => [x.name, `${fmtQty(x.qty)} ${x.unit === "den" ? "dní" : "hod"} × ${kc(h(x.rate))}`])} />
                <Rows label="Výdaje (náklad)" rows={l.example.expenses.map((x) => [x.description, `${fmtQty(x.qty)} × ${kc(h(x.unitPrice))}`])} />
              </div>
              <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-3 bg-paper p-5 md:border-l md:border-line">
                <div><dt className="text-[13px] text-muted">Cena bez DPH</dt><dd className="num font-display text-[20px] font-extrabold">{kc(s.revenue.net)}</dd></div>
                <div><dt className="text-[13px] text-muted">Náklady</dt><dd className="num font-display text-[20px] font-extrabold">{kc(s.costs.total)}</dd></div>
                <div><dt className="text-[13px] text-muted">Výdělek</dt><dd className="num font-display text-[20px] font-extrabold text-ok">{kc(s.profit)}</dd></div>
                <div><dt className="text-[13px] text-muted">Marže</dt><dd className="num font-display text-[20px] font-extrabold text-ok">{s.marginBp === null ? "–" : formatPercent(s.marginBp)}</dd></div>
                <div className="col-span-2 border-t border-line pt-3"><dt className="text-[13px] text-muted">Cena pro zákazníka s DPH {s.vatRate} %</dt><dd className="num font-display text-[22px] font-extrabold">{kc(s.gross)}</dd></div>
              </dl>
            </div>
          </section>
        )}

        <section className="pt-12" aria-labelledby="ukazky">
          <h2 id="ukazky" className="font-display text-[26px] font-extrabold sm:text-[30px]">Takhle to vypadá v aplikaci</h2>
          <div className={`mt-5 grid items-start gap-5 ${l.shots.length === 3 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:max-w-xl"}`}>
            {l.shots.map((k) => {
              const x = SHOTS[k];
              return (
                <figure key={k}>
                  <div className={x.phone ? "overflow-hidden rounded-[1.6rem] border-[5px] border-ink bg-white shadow-[0_18px_40px_rgba(5,38,76,0.18)]" : "overflow-hidden rounded-lg border border-line bg-white shadow-[0_18px_40px_rgba(5,38,76,0.14)]"}>
                    <Image src={x.src} alt={x.alt} width={x.w} height={x.h} sizes="(min-width: 768px) 280px, 45vw" className="h-auto w-full" />
                  </div>
                  <figcaption className="mt-2 text-center text-[13px] text-muted">{x.caption}</figcaption>
                </figure>
              );
            })}
          </div>
          <Link href="/jak-to-funguje" className="mt-4 inline-block font-semibold text-accent-ink underline">Projít aplikaci krok za krokem →</Link>
        </section>

        {l.inquiryCategory && (
          <section className="pt-12" aria-labelledby="poptavky">
            <div className="card flex flex-wrap items-center justify-between gap-4 bg-accent-soft p-5 sm:p-6">
              <div className="max-w-xl">
                <h2 id="poptavky" className="font-display text-[22px] font-extrabold">Poptávky z oboru {CATEGORY_LABEL[l.inquiryCategory]}</h2>
                <p className="mt-1 text-[15px] text-muted">Zákazníci zadávají poptávky zdarma. S ověřeným IČO uvidíte jejich kontakt a pošlete nabídku přímo v systému.</p>
              </div>
              <Link href={`/poptavky?kategorie=${l.inquiryCategory}`} className="btn-dark">Prohlédnout poptávky</Link>
            </div>
          </section>
        )}

        <section className="pt-12" aria-labelledby="otazky">
          <h2 id="otazky" className="mb-3 font-display text-[26px] font-extrabold sm:text-[30px]">Časté otázky</h2>
          <FaqList items={l.faq} />
        </section>

        <nav className="pt-12" aria-labelledby="dalsi">
          <h2 id="dalsi" className="font-display text-[20px] font-extrabold">Další informace pro řemeslníky</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}><Link href={`/${o.slug}`} className="inline-block rounded-full border border-line bg-white px-3.5 py-2 text-[14px] font-semibold hover:border-ink/30">{o.name}</Link></li>
            ))}
            <li><Link href="/cenik" className="inline-block rounded-full border border-line bg-white px-3.5 py-2 text-[14px] font-semibold hover:border-ink/30">Ceník</Link></li>
          </ul>
        </nav>
      </div>

      <section className="mt-14 bg-ink text-white" aria-labelledby="zacit">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5 px-5 py-10">
          <div>
            <h2 id="zacit" className="font-display text-[24px] font-extrabold sm:text-[28px]">Vyzkoušejte 30 dní zdarma</h2>
            <p className="mt-1 text-white/70">Všechny funkce, bez platební karty. Zkušební období se samo nezmění v placené.</p>
          </div>
          <Link href="/prihlaseni?rezim=registrace" className="btn-primary">Vyzkoušet zdarma</Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function fmtQty(n: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(n);
}

function Rows({ label, rows }: { label: string; rows: [string, string][] }) {
  if (!rows.length) return null;
  return (
    <div className="px-5 py-3.5">
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-accent-ink">{label}</h3>
      <ul className="mt-1.5 space-y-1.5">
        {rows.map(([a, b]) => (
          <li key={a} className="flex flex-wrap justify-between gap-x-4 text-[15px]"><span>{a}</span><span className="num text-muted">{b}</span></li>
        ))}
      </ul>
    </div>
  );
}
