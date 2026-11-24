import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { InquiryCard } from "@/components/InquiryCard";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, INQUIRY_CATEGORIES, type PublicInquiry } from "@/lib/inquiries";

export const metadata: Metadata = {
  title: "Poptávky řemeslných prací",
  description: "Aktuální poptávky malování, fasád, střech, rekonstrukcí a dalších řemeslných prací. Zadejte poptávku zdarma, řemeslníci se vám ozvou.",
};

const PAGE = 20;

export default async function InquiriesPage({ searchParams }: PageProps<"/poptavky">) {
  const sp = await searchParams;
  const category = typeof sp.kategorie === "string" && CATEGORY_LABEL[sp.kategorie] ? sp.kategorie : "";
  const city = typeof sp.misto === "string" ? sp.misto.slice(0, 60) : "";
  const page = Math.max(1, Number(sp.strana) || 1);

  const supabase = await createClient();
  const { data } = await supabase.rpc("list_inquiries", {
    p_category: category || null, p_city: city || null, p_limit: PAGE, p_offset: (page - 1) * PAGE,
  });
  const list = (data ?? { total: 0, items: [] }) as { total: number; items: PublicInquiry[] };
  const pages = Math.max(1, Math.ceil(list.total / PAGE));
  const href = (p: number) => `/poptavky?${new URLSearchParams({ ...(category && { kategorie: category }), ...(city && { misto: city }), ...(p > 1 && { strana: String(p) }) })}`;

  return (
    <main>
      <SiteHeader current="poptavky" />
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-5 pb-8 pt-8">
          <div>
            <h1 className="font-display text-[30px] font-extrabold leading-tight sm:text-[38px]">Poptávky řemeslných prací</h1>
            <p className="mt-2 max-w-xl text-[16px] text-white/75">
              Hledáte řemeslníka? Zadejte poptávku zdarma a bez registrace. Ozvou se vám ověření řemeslníci z iRemeslo.cz.
            </p>
          </div>
          <Link href="/poptavky/nova" className="btn-primary">Zadat poptávku zdarma</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" role="search">
          <div>
            <label className="label" htmlFor="kategorie">Obor</label>
            <select className="field" id="kategorie" name="kategorie" defaultValue={category}>
              <option value="">Všechny obory</option>
              {INQUIRY_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="misto">Obec nebo PSČ</label>
            <input className="field" id="misto" name="misto" defaultValue={city} placeholder="např. Brno" />
          </div>
          <button className="btn-dark">Hledat</button>
        </form>

        <p className="text-[14px] text-muted" aria-live="polite">
          {list.total === 0 ? "Žádná aktivní poptávka" : list.total === 1 ? "1 aktivní poptávka" : list.total < 5 ? `${list.total} aktivní poptávky` : `${list.total} aktivních poptávek`}
          {(category || city) && <> · <Link href="/poptavky" className="font-semibold text-accent-ink underline">zrušit filtr</Link></>}
        </p>

        {list.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.items.map((q) => <InquiryCard key={q.id} q={q} />)}
          </div>
        ) : (
          <div className="card px-5 py-10 text-center">
            <p className="text-muted">{category || city ? "Tomuto hledání zatím žádná poptávka neodpovídá." : "Zatím tu není žádná poptávka."}</p>
            <Link href="/poptavky/nova" className="btn-primary mt-4">Zadat první poptávku</Link>
          </div>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-center gap-3 text-[14px]" aria-label="Stránkování">
            {page > 1 && <Link href={href(page - 1)} className="btn-ghost">← Novější</Link>}
            <span className="num text-muted">Strana {page} z {pages}</span>
            {page < pages && <Link href={href(page + 1)} className="btn-ghost">Starší →</Link>}
          </nav>
        )}

        <aside className="card flex flex-wrap items-center justify-between gap-3 border-dashed p-5">
          <p className="text-[15px]"><strong>Jste řemeslník?</strong> Kontakty na zadavatele vidí registrovaní uživatelé iRemeslo.cz.</p>
          <Link href="/prihlaseni?rezim=registrace&next=/poptavky" className="btn-ghost">Registrovat se zdarma</Link>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}
