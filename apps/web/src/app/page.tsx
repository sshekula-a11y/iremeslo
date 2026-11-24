import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { InquiryRow } from "@/components/InquiryCard";
import { createClient } from "@/lib/supabase/server";
import type { PublicInquiry } from "@/lib/inquiries";

const GDPR = [
  "Databáze běží v EU (Frankfurt), spojení je vždy šifrované.",
  "Data každé firmy jsou oddělená – nikdo cizí je nevidí.",
  "Žádné reklamní ani sledovací cookies, údaje neprodáváme.",
  "Na požádání vám data předáme nebo je smažeme.",
];

const benefits = [
  { title: "Nabídka za pár minut", text: "Práce, materiál, zaměstnanci a výdaje na jednom místě. Ceny z vašeho ceníku se doplní samy, PDF pošlete zákazníkovi rovnou ze stavby." },
  { title: "Vidíte skutečný zisk", text: "U každé zakázky porovnáte náklady s tím, co fakturujete. Když marže klesne pod vaši hranici, aplikace vás upozorní." },
  { title: "Faktura podle zákona", text: "Plátce i neplátce DPH, 12 i 21 %, přenesená daňová povinnost, zálohy s daňovým dokladem a QR Platba. Doklady jsou číslované bez mezer." },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_inquiries", { p_limit: 10 });
  const latest = ((data as { items?: PublicInquiry[] } | null)?.items ?? []);
  const total = (data as { total?: number } | null)?.total ?? 0;

  return (
    <main>
      <SiteHeader />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-14 pt-10 sm:pt-14">
          <h1 className="max-w-3xl font-display text-[36px] font-extrabold leading-[1.08] tracking-tight sm:text-[52px]">
            Najděte řemeslníka. <span className="block text-accent">Nebo novou zakázku.</span>
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
              <p className="mt-2 text-[15px] text-white/75">
                Nové zakázky z poptávek, cenová nabídka a faktura s QR Platbou za pár minut a přehled o zisku
                z každé zakázky. 30 dní zdarma, bez platební karty.
              </p>
              <div className="mt-auto flex flex-wrap gap-3 pt-5">
                <Link href="/prihlaseni?rezim=registrace" className="btn bg-white text-ink hover:bg-white/90">Vyzkoušet zdarma</Link>
                <Link href="/poptavky" className="btn border border-white/20 text-white hover:bg-white/10">Prohlédnout poptávky</Link>
              </div>
            </section>
          </div>

          <p className="mt-6 text-[14px] text-white/60">
            Pro malíře, fasádníky, pokrývače, obkladače, elektrikáře, instalatéry, zahradníky i úklidové firmy.{" "}
            <Link href="/jak-to-funguje" className="font-semibold text-white/85 underline underline-offset-2 hover:text-white">Jak to funguje</Link>
          </p>
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
          {latest.length ? (
            <ul className="divide-y divide-line">
              {latest.map((q) => <InquiryRow key={q.id} q={q} />)}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-muted">Zatím tu není žádná poptávka. Buďte první – zadání trvá pár minut.</p>
              <Link href="/poptavky/nova" className="btn-ghost mt-3">Zadat první poptávku</Link>
            </div>
          )}
        </div>
      </section>

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
