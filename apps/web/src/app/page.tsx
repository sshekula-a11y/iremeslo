import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR } from "@/lib/operator";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { InquiryRow } from "@/components/InquiryCard";
import { createClient } from "@/lib/supabase/server";
import type { InquiryList } from "@/lib/inquiries";
import { FaqList } from "@/components/FaqList";
import { FAQ_CUSTOMERS, FAQ_TRADESMEN } from "@/lib/faq";
import { CUSTOMER_STEPS, FEATURES, TRADESMAN_STEPS, TRUST } from "@/lib/marketing";
import { PRICE_FROM } from "@/lib/pricing";


export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Strukturovaná data pro vyhledávače: kdo web provozuje a jak se jmenuje. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "iRemeslo.cz",
      legalName: OPERATOR.name,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/logo.png`,
      email: OPERATOR.email,
      vatID: OPERATOR.dic,
      address: { "@type": "PostalAddress", streetAddress: "Hybernská 1007/20", postalCode: "110 00", addressLocality: "Praha", addressCountry: "CZ" },
    },
    { "@type": "WebSite", "@id": `${SITE_URL}/#web`, name: "iRemeslo.cz", url: SITE_URL, inLanguage: "cs", publisher: { "@id": `${SITE_URL}/#org` } },
  ],
};

/** Čtyři nejčastější otázky: dvě zákaznické, dvě řemeslnické. */
const faq = [
  ...FAQ_CUSTOMERS.filter((f) => ["Je zadání poptávky zdarma?", "Kdo uvidí můj kontakt?"].includes(f.q)),
  ...FAQ_TRADESMEN.filter((f) => ["Kolik to stojí?", "Funguje to na mobilu?"].includes(f.q)),
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-14 pt-10 sm:pt-14">
          <h1 className="max-w-[60rem] font-display text-[32px] font-extrabold leading-[1.08] tracking-tight min-[390px]:text-[34px] sm:text-[50px]">
            iRemeslo.cz je vaše virtuální kancelář <span className="block text-accent">+ veřejné poptávky</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/80 sm:text-[19px]">
            iRemeslo.cz propojuje zákazníky s řemeslníky. Zákazník zadá poptávku zdarma, řemeslník ji najde,
            spočítá, pošle nabídku a vystaví fakturu – vše z telefonu.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <section className="flex flex-col rounded-2xl bg-white p-5 text-ink sm:p-6" aria-labelledby="hledam">
              <p className="text-[13px] font-bold uppercase tracking-wider text-accent-ink">Pro zákazníky</p>
              <h2 id="hledam" className="mt-1 font-display text-[24px] font-extrabold leading-tight">Hledám řemeslníka</h2>
              <p className="mt-2 text-[15px] text-muted">
                Popište, co potřebujete – třeba zateplení fasády 180 m² v Brně. Zadání je zdarma a bez registrace,
                řemeslníci se vám ozvou sami.
              </p>
              <div className="mt-auto pt-5">
                <Link href="/poptavky/nova" className="btn-primary w-full sm:w-auto">Zadat poptávku zdarma</Link>
              </div>
            </section>
            <section className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-5 sm:p-6" aria-labelledby="jsem">
              <p className="text-[13px] font-bold uppercase tracking-wider text-accent">Pro řemeslníky</p>
              <h2 id="jsem" className="mt-1 font-display text-[24px] font-extrabold leading-tight">Jsem řemeslník</h2>
              <p className="mt-2 text-[15px] text-white/80">
                iRemeslo.cz je virtuální kancelář, která především pomáhá vaší firmě uspořádat data: harmonogram, náklady, cenové nabídky, faktury,
                smlouvy o dílo, předávací protokoly i nové zakázky z poptávek – vše, co potřebujete, na jednom místě.
              </p>
              <p className="mt-3 text-[13px] font-semibold text-accent">30 dní zdarma · bez platební karty</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-5">
                <Link href="/prihlaseni?rezim=registrace" className="btn bg-white text-ink hover:bg-white/90">Vyzkoušet zdarma</Link>
                <Link href="/poptavky" className="btn border border-white/20 text-white hover:bg-white/10">Prohlédnout poptávky</Link>
              </div>
            </section>
          </div>

          <p className="mt-6 text-[14px] text-white/60">
            Pro malíře, fasádníky, pokrývače, obkladače, elektrikáře, instalatéry, zahradníky, firmy na čištění a renovace exteriérů i úklidové firmy.{" "}
            <Link href="/jak-to-funguje" className="font-semibold text-white/85 underline underline-offset-2 hover:text-white">Jak to funguje</Link>
          </p>
        </div>
      </header>

      <p className="border-b border-line bg-white">
        <span className="mx-auto block max-w-5xl px-5 py-4 text-center font-display text-[17px] font-bold sm:text-[19px]">
          Více zakázek. <span className="text-accent-ink">Méně administrativy.</span> Lepší přehled o podnikání.
        </span>
      </p>

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
          {latest.length === 0 && (
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

        <section className="grid gap-4 pt-14 md:grid-cols-2" aria-label="Cena a důvěra">
          <div className="card flex flex-col p-5 sm:p-6">
            <h2 className="font-display text-[22px] font-extrabold">Cena</h2>
            <p className="mt-2 text-[16px]">
              Zadání poptávky je pro zákazníky <strong>vždy zdarma</strong>. Řemeslníci mají <strong>30 dní zdarma</strong>,
              pak od <strong className="num">{PRICE_FROM} Kč</strong> měsíčně bez DPH.
            </p>
            <div className="mt-auto pt-4"><Link href="/cenik" className="btn-ghost">Zobrazit ceník</Link></div>
          </div>
          <div className="card p-5 sm:p-6">
            <h2 className="font-display text-[22px] font-extrabold">Komu svěřujete data</h2>
            <ul className="mt-2 space-y-1.5 text-[15px]">
              {TRUST.map((t) => <li key={t} className="flex gap-2"><span className="text-ok" aria-hidden="true">✓</span><span>{t}</span></li>)}
            </ul>
            <Link href="/ochrana-osobnich-udaju" className="mt-3 inline-block text-[14px] font-semibold text-accent-ink underline">Ochrana osobních údajů</Link>
          </div>
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
