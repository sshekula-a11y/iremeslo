import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SITE_URL } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";
import { ORGANIZATION, ORG_ID, SOFTWARE_APP } from "@/lib/seo";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { InquiryRow } from "@/components/InquiryCard";
import { createClient } from "@/lib/supabase/server";
import type { InquiryList } from "@/lib/inquiries";
import { FaqList } from "@/components/FaqList";
import { FAQ_CUSTOMERS, FAQ_TRADESMEN } from "@/lib/faq";
import { CUSTOMER_STEPS, FEATURES, SECURITY, TRADESMAN_STEPS } from "@/lib/marketing";
import { PLANS, kc } from "@/lib/pricing";


export const metadata: Metadata = { alternates: { canonical: "/" } };

const WEBSITE = { "@type": "WebSite", "@id": `${SITE_URL}/#web`, name: "iRemeslo.cz", url: SITE_URL, inLanguage: "cs", publisher: { "@id": ORG_ID } };

/** Čtyři nejčastější otázky: dvě zákaznické, dvě řemeslnické. */
const faq = [
  ...FAQ_CUSTOMERS.filter((f) => ["Je zadání poptávky zdarma?", "Kdo uvidí můj kontakt?"].includes(f.q)),
  ...FAQ_TRADESMEN.filter((f) => ["Kolik to stojí?", "Funguje to na mobilu?", "Může zákazník podepsat na mobilu?"].includes(f.q)),
];

function Steps({ label, steps }: { label: string; steps: { title: string; text: string }[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-[13px] font-bold uppercase tracking-wider text-accent-ink">{label}</h3>
      <ol className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="card p-4">
            <span className="num flex size-7 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-ink" aria-hidden="true">{i + 1}</span>
            <p className="mt-2 font-semibold leading-snug">{s.title}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_inquiries", { p_limit: 10 });
  const list = data as InquiryList | null;
  const latest = list?.items ?? [];
  const total = list?.total ?? 0;
  // Ukázky jen doplní místo, dokud je skutečných poptávek málo – vždy pod nimi a se štítkem.
  const demo = (list?.demo ?? []).slice(0, Math.max(10 - latest.length, 0));

  return (
    <main>
      <JsonLd nodes={[ORGANIZATION, WEBSITE, SOFTWARE_APP]} />
      <SiteHeader />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:pb-14 sm:pt-12">
          <h1 className="font-display text-[31px] font-extrabold leading-[1.08] tracking-tight min-[390px]:text-[34px] sm:text-[52px]">
            Více zakázek. Lepší přehled. <span className="text-accent">Vyšší zisk.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-white/80 sm:mt-4 sm:text-[19px]">
            Program pro řemeslníky a veřejné poptávky v jednom. Najdete zakázky, spočítáte cenu i zisk a vystavíte nabídku,
            smlouvu i fakturu – z telefonu.
          </p>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
            <section className="flex flex-col rounded-2xl bg-white p-4 text-ink sm:p-6" aria-labelledby="hledam">
              <h2 id="hledam" className="font-display text-[21px] font-extrabold leading-tight sm:text-[24px]">Hledám řemeslníka</h2>
              <p className="mt-1 text-[15px] text-muted">Poptávka zdarma a bez registrace. Řemeslníci se vám ozvou sami.</p>
              <div className="mt-auto pt-3 sm:pt-5">
                <Link href="/poptavky/nova" className="btn-primary w-full sm:w-auto">Zadat poptávku zdarma</Link>
              </div>
            </section>
            <section className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-4 sm:p-6" aria-labelledby="jsem">
              <h2 id="jsem" className="font-display text-[21px] font-extrabold leading-tight sm:text-[24px]">Jsem řemeslník</h2>
              <p className="mt-1 text-[15px] text-white/80">
                Zakázky s kalkulací a marží, nabídky, faktury a smlouvy s podpisem prstem. <strong className="text-accent">30 dní zdarma, bez karty.</strong>
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 sm:pt-5">
                <Link href="/prihlaseni?rezim=registrace" className="btn w-full bg-white text-ink hover:bg-white/90 sm:w-auto">Vyzkoušet zdarma</Link>
                <Link href="/poptavky" className="text-[15px] font-semibold text-white/85 underline underline-offset-2 hover:text-white">Prohlédnout poptávky</Link>
              </div>
            </section>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-white/70" aria-label="Proč iRemeslo.cz">
            <li><span className="text-accent" aria-hidden="true">✓ </span>Data v EU, každá firma zvlášť</li>
            <li><span className="text-accent" aria-hidden="true">✓ </span>Faktury podle zákona o DPH</li>
            <li><span className="text-accent" aria-hidden="true">✓ </span>Česká firma a podpora</li>
          </ul>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pt-12" aria-labelledby="poptavky">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-accent-soft p-5 sm:p-6">
            <div className="max-w-xl">
              <h2 id="poptavky" className="font-display text-[24px] font-extrabold leading-tight">Hledáte řemeslníka?</h2>
              <p className="mt-1 text-[15px] text-muted">
                Zadejte poptávku zdarma a bez registrace – třeba „zateplení fasády 500 m², Brno, do 3 měsíců“. Ozvou se vám řemeslníci z iRemeslo.cz.
              </p>
            </div>
            <Link href="/poptavky/nova" className="btn-primary">Zadat poptávku zdarma</Link>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 pb-3 pt-5 sm:px-5">
            <h3 className="font-display text-[18px] font-bold">Nejnovější poptávky</h3>
            {total > 0 && <Link href="/poptavky" className="text-[14px] font-semibold text-accent-ink hover:underline">Všechny poptávky ({total}) →</Link>}
          </div>
          {latest.length > 0 && (
            <ul className="divide-y divide-line">
              {latest.map((q) => <InquiryRow key={q.id} q={q} />)}
            </ul>
          )}
          {/* Prázdný stav jen tehdy, když nejsou ani ukázky. */}
          {latest.length === 0 && demo.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-muted">Zatím tu není žádná skutečná poptávka. Buďte první – zadání trvá pár minut.</p>
              <Link href="/poptavky/nova" className="btn-ghost mt-3">Zadat první poptávku</Link>
            </div>
          )}
          {demo.length > 0 && (
            <>
              <p className="border-y border-line bg-paper px-4 py-2 text-[13px] text-muted sm:px-5">
                <strong className="text-ink">Ukázky</strong> – takto budou poptávky vypadat. Nejde o skutečné zakázky.
              </p>
              <ul className="divide-y divide-line">
                {demo.map((q) => <InquiryRow key={q.id} q={q} />)}
              </ul>
            </>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5">
        <section className="pt-14" aria-labelledby="ukazka">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <h2 id="ukazka" className="font-display text-[26px] font-extrabold sm:text-[30px]">Víte, kolik na zakázce vyděláte – dřív, než ji vezmete</h2>
              <ul className="mt-4 space-y-3 text-[16px]">
                <li className="flex gap-2"><span className="font-bold text-ok" aria-hidden="true">✓</span><span><strong>Kalkulace:</strong> práce, materiál, lidé a výdaje. Hned vidíte cenu, náklady, výdělek a marži.</span></li>
                <li className="flex gap-2"><span className="font-bold text-ok" aria-hidden="true">✓</span><span><strong>Nabídka v PDF</strong> s vaším logem a razítkem jedním klepnutím ze zakázky.</span></li>
                <li className="flex gap-2"><span className="font-bold text-ok" aria-hidden="true">✓</span><span><strong>Smlouva, předávací protokol a faktura</strong> z téže zakázky – nic nepřepisujete.</span></li>
              </ul>
              <Link href="/jak-to-funguje" className="mt-5 inline-block font-semibold text-accent-ink underline">Projít aplikaci krok za krokem →</Link>
            </div>
            <div className="grid grid-cols-2 items-start gap-4 md:w-[30rem]">
              <figure>
                <div className="overflow-hidden rounded-[1.6rem] border-[5px] border-ink bg-white shadow-[0_18px_40px_rgba(5,38,76,0.18)]">
                  <Image src="/jak-to-funguje/zakazka-telefon.webp" alt="Zakázka na telefonu: materiál a souhrn s náklady, výdělkem a marží" width={780} height={1688} sizes="(min-width: 768px) 232px, 45vw" className="h-auto w-full" />
                </div>
                <figcaption className="mt-2 text-center text-[13px] text-muted">Zakázka na telefonu</figcaption>
              </figure>
              <figure className="pt-8">
                <div className="overflow-hidden rounded-lg border border-line bg-white shadow-[0_18px_40px_rgba(5,38,76,0.14)]">
                  <Image src="/jak-to-funguje/nabidka.webp" alt="Cenová nabídka v PDF s dodavatelem, odběratelem, položkami a součtem s DPH" width={1240} height={1753} sizes="(min-width: 768px) 232px, 45vw" className="h-auto w-full" />
                </div>
                <figcaption className="mt-2 text-center text-[13px] text-muted">Nabídka, kterou dostane zákazník</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="pt-14" aria-labelledby="funkce">
          <h2 id="funkce" className="font-display text-[26px] font-extrabold sm:text-[30px]">Vše pro vaše řemeslo na jednom místě</h2>
          <p className="mt-1 text-[16px] text-muted">iRemeslo.cz je virtuální kancelář – na telefonu i na počítači.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5">
                <h3 className="font-display text-[18px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
          <Link href="/pro-remeslniky" className="mt-4 inline-block font-semibold text-accent-ink underline">Více pro řemeslníky →</Link>
        </section>

        <section className="pt-14" aria-labelledby="jak">
          <h2 id="jak" className="font-display text-[26px] font-extrabold sm:text-[30px]">Jak to funguje</h2>
          <Steps label="Zákazník" steps={CUSTOMER_STEPS} />
          <Steps label="Řemeslník" steps={TRADESMAN_STEPS} />
          <Link href="/jak-to-funguje" className="mt-4 inline-block font-semibold text-accent-ink underline">Krok za krokem s ukázkami z aplikace →</Link>
        </section>

        <section className="pt-14" aria-labelledby="cena">
          <h2 id="cena" className="font-display text-[26px] font-extrabold sm:text-[30px]">Cena</h2>
          <p className="mt-1 text-[16px] text-muted">Zákazníci zadávají poptávky <strong className="text-ink">vždy zdarma</strong>. Řemeslníci mají ve všech tarifech všechny funkce; ceny jsou bez DPH.</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {PLANS.map((p) => (
              <li key={p.id} className={`card flex flex-col p-5 ${p.id === "zakladni" ? "ring-2 ring-accent" : ""}`}>
                <h3 className="font-display text-[18px] font-bold">{p.name}</h3>
                <p className="mt-2 font-display text-[28px] font-extrabold leading-none">
                  {p.month ? <><span className="num">{kc(p.month)} Kč</span><span className="text-[15px] font-semibold text-muted"> / měsíc</span></> : "Zdarma"}
                </p>
                <p className="mt-1 text-[14px] text-muted">{p.year ? <>nebo <span className="num">{kc(p.year)} Kč</span> ročně</> : "bez platební karty"}</p>
                <p className="mt-3 text-[15px]">{p.note}. Uživatelé: {p.users}.</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link href="/prihlaseni?rezim=registrace" className="btn-primary">Vyzkoušet 30 dní zdarma</Link>
            <Link href="/cenik" className="font-semibold text-accent-ink underline">Celý ceník a co je v ceně →</Link>
          </div>
        </section>

        <section className="pt-14" aria-labelledby="bezpecnost">
          <h2 id="bezpecnost" className="font-display text-[26px] font-extrabold sm:text-[30px]">Bezpečnost dat</h2>
          <p className="mt-1 text-[16px] text-muted">Svěřujete nám zakázky, ceny a faktury. Takhle s nimi zacházíme.</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((x) => (
              <li key={x.title} className="card p-5">
                <h3 className="font-display text-[17px] font-bold"><span className="text-ok" aria-hidden="true">✓ </span>{x.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{x.text}</p>
              </li>
            ))}
          </ul>
          <Link href="/bezpecnost-dat" className="mt-4 inline-block font-semibold text-accent-ink underline">Kdo data zpracovává a co se s nimi stane, když skončíte →</Link>
        </section>

        <section className="pt-14" aria-labelledby="otazky">
          <h2 id="otazky" className="mb-3 font-display text-[26px] font-extrabold sm:text-[30px]">Časté otázky</h2>
          <FaqList items={faq} />
          <Link href="/caste-otazky" className="mt-3 inline-block font-semibold text-accent-ink underline">Všechny otázky →</Link>
        </section>
      </div>

      <section className="mt-14 bg-ink text-white" aria-labelledby="zacit">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5 px-5 py-10">
          <h2 id="zacit" className="font-display text-[24px] font-extrabold sm:text-[28px]">Hledáte řemeslníka, nebo zakázky?</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/poptavky/nova" className="btn-primary">Zadat poptávku zdarma</Link>
            <Link href="/prihlaseni?rezim=registrace" className="btn bg-white text-ink hover:bg-white/90">Vyzkoušet zdarma</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
