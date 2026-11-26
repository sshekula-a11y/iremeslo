import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { PublicInquiry } from "@/lib/inquiries";
import { closeInquiry } from "./actions";
import { OfferCompare, type CustomerOffer } from "./OfferCompare";

export const metadata: Metadata = { title: "Správa poptávky", robots: { index: false, follow: false } };

/** Sem vede odkaz z e-mailu zadavatele: první otevření poptávku zveřejní, další slouží k jejímu uzavření. */
export default async function ManageInquiryPage({ searchParams }: PageProps<"/poptavky/sprava">) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const supabase = await createClient();
  const { data } = await supabase.rpc("confirm_inquiry", { p_token: token });
  const r = (data ?? { ok: false }) as { ok: boolean; just_confirmed?: boolean; inquiry?: PublicInquiry };
  const q = r.inquiry;
  const { data: offerData } = r.ok ? await supabase.rpc("inquiry_offers", { p_token: token }) : { data: null };
  const offers = (offerData ?? []) as CustomerOffer[];

  return (
    <main>
      <SiteHeader current="poptavky" />
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-12">
        {!r.ok || !q ? (
          <section className="card mx-auto max-w-md p-6">
            <h1 className="font-display text-[24px] font-extrabold">Odkaz nefunguje</h1>
            <p className="mt-2 text-[15px] text-muted">
              Odkaz je neúplný nebo vypršel. Nepotvrzené poptávky mažeme po 3 dnech – zadejte prosím poptávku znovu.
            </p>
            <Link href="/poptavky/nova" className="btn-primary mt-6 w-full">Zadat poptávku</Link>
          </section>
        ) : (
          <>
          <section className="card mx-auto max-w-md p-6">
            {r.just_confirmed ? (
              <>
                <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ok-soft text-[24px] font-bold text-ok" aria-hidden="true">✓</span>
                <h1 className="font-display text-[24px] font-extrabold">Poptávka je zveřejněná</h1>
                <p className="mt-2 text-[15px] text-muted">Děkujeme. Řemeslníci vám pošlou nabídky – přijdou vám e-mailem a porovnáte je tady. Mohou se ozvat i telefonem.</p>
              </>
            ) : (
              <h1 className="font-display text-[24px] font-extrabold">Vaše poptávka</h1>
            )}
            <p className="mt-4 rounded-xl bg-paper p-3 text-[15px]"><strong>{q.title}</strong><br /><span className="text-muted">{q.city}</span></p>
            <ul className="mt-3 space-y-1 text-[14px] text-muted">
              <li>Stav: <strong className="text-ink">{q.status === "open" ? "zveřejněná" : q.status === "closed" ? "uzavřená" : q.status === "expired" ? "platnost skončila" : "skrytá"}</strong></li>
              {q.status === "open" && <li>Platí do {formatDate(q.expires_at.slice(0, 10))}</li>}
              <li>Kontakt si zobrazilo řemeslníků: <strong className="num text-ink">{q.views}</strong></li>
            </ul>
            {q.status === "open" && (
              <>
                <Link href={`/poptavky/${q.id}`} className="btn-ghost mt-5 w-full">Zobrazit poptávku</Link>
                <form action={closeInquiry} className="mt-3">
                  <input type="hidden" name="t" value={token} />
                  <button className="btn-dark w-full">Uzavřít poptávku – už mám dodavatele</button>
                </form>
                <p className="mt-2 text-[13px] text-muted">Po uzavření zmizí ze seznamu a kontakt už nikdo neuvidí. Tento odkaz si uschovejte.</p>
              </>
            )}
            {sp.uzavreno === "1" && q.status === "closed" && (
              <p className="mt-4 rounded-xl bg-ok-soft px-3 py-2.5 text-[14px] text-ok" role="status">Poptávka je uzavřená. Děkujeme, že jste využili iRemeslo.cz.</p>
            )}
            {offers.length > 0 && <a href="#nabidky" className="btn-primary mt-3 w-full">Porovnat nabídky ({offers.length})</a>}
          </section>
          {q.status !== "pending" && <OfferCompare token={token} offers={offers} open={q.status === "open"} />}
          </>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
