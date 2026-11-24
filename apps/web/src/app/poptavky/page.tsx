import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { InquiryCard } from "@/components/InquiryCard";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, INQUIRY_AGES, INQUIRY_CATEGORIES, REGIONS, REGION_LABEL, type InquiryList } from "@/lib/inquiries";

const META = {
  title: "Poptávky řemeslných prací",
  description: "Aktuální poptávky malování, fasád, střech, rekonstrukcí a dalších řemeslných prací. Zadejte poptávku zdarma, řemeslníci se vám ozvou.",
};

/** Filtrované výsledky do vyhledávačů nepatří (stejný obsah pod mnoha adresami). */
export async function generateMetadata({ searchParams }: PageProps<"/poptavky">): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = ["kategorie", "kraj", "misto", "stari", "moje"].some((k) => typeof sp[k] === "string" && sp[k] !== "");
  return { ...META, alternates: { canonical: "/poptavky" }, ...(filtered ? { robots: { index: false, follow: true } } : {}) };
}

const PAGE = 20;

export default async function InquiriesPage({ searchParams }: PageProps<"/poptavky">) {
  const sp = await searchParams;
  const category = typeof sp.kategorie === "string" && CATEGORY_LABEL[sp.kategorie] ? sp.kategorie : "";
  const city = typeof sp.misto === "string" ? sp.misto.slice(0, 60) : "";
  const region = typeof sp.kraj === "string" && REGION_LABEL[sp.kraj] ? sp.kraj : "";
  const days = typeof sp.stari === "string" && ["1", "7", "30"].includes(sp.stari) ? sp.stari : "";
  const page = Math.max(1, Number(sp.strana) || 1);

  const supabase = await createClient();
  // Přihlášená firma: obory podle jejích profesí (nejvýš 5) pro filtr „Moje obory“.
  const { data: auth } = await supabase.auth.getClaims();
  const loggedIn = !!auth?.claims?.sub;
  let myCategories: string[] = [];
  if (loggedIn) {
    const { data: mine } = await supabase.from("company_professions").select("professions(category)");
    myCategories = [...new Set(((mine ?? []) as unknown as { professions: { category: string } | null }[]).map((r) => r.professions?.category).filter((c): c is string => !!c))];
  }
  const onlyMine = sp.moje === "1" && myCategories.length > 0;
  const { data } = await supabase.rpc("list_inquiries", {
    p_category: category || null, p_city: city || null, p_limit: PAGE, p_offset: (page - 1) * PAGE,
    p_region: region || null, p_days: days ? Number(days) : null,
    p_categories: onlyMine ? myCategories : null,
  });
  const list = (data ?? { total: 0, real_total: 0, items: [], demo: [] }) as InquiryList;
  const filtered = !!(category || city || region || days || onlyMine);
  const pages = Math.max(1, Math.ceil(list.total / PAGE));
  const href = (p: number) => `/poptavky?${new URLSearchParams({ ...(category && { kategorie: category }), ...(region && { kraj: region }), ...(city && { misto: city }), ...(days && { stari: days }), ...(onlyMine && { moje: "1" }), ...(p > 1 && { strana: String(p) }) })}`;

  return (
    <main>
      <SiteHeader current="poptavky" />
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-5 pb-8 pt-8">
          <div>
            <h1 className="font-display text-[30px] font-extrabold leading-tight sm:text-[38px]">Poptávky řemeslných prací</h1>
            <p className="mt-2 max-w-xl text-[16px] text-white/75">
              Hledáte řemeslníka? Zadejte poptávku zdarma a bez registrace. Ozvou se vám řemeslníci s IČO ověřeným v ARES.
            </p>
          </div>
          <Link href="/poptavky/nova" className="btn-primary">Zadat poptávku zdarma</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto] lg:items-end" role="search">
          {onlyMine && <input type="hidden" name="moje" value="1" />}
          <div>
            <label className="label" htmlFor="kategorie">Obor</label>
            <select className="field" id="kategorie" name="kategorie" defaultValue={category}>
              <option value="">Všechny obory</option>
              {INQUIRY_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="kraj">Kraj</label>
            <select className="field" id="kraj" name="kraj" defaultValue={region}>
              <option value="">Celá ČR</option>
              {REGIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="misto">Obec nebo PSČ</label>
            <input className="field" id="misto" name="misto" defaultValue={city} placeholder="např. Brno" />
          </div>
          <div>
            <label className="label" htmlFor="stari">Zadáno</label>
            <select className="field" id="stari" name="stari" defaultValue={days}>
              <option value="">kdykoli</option>
              {INQUIRY_AGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <button className="btn-dark sm:col-span-2 lg:col-span-1">Hledat</button>
        </form>

        {loggedIn && (myCategories.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Obory">
            <Link href={`/poptavky?${new URLSearchParams({ ...(region && { kraj: region }), ...(city && { misto: city }), ...(days && { stari: days }) })}`}
              aria-current={!onlyMine ? "true" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-[14px] font-semibold ${!onlyMine ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}>Všechny obory</Link>
            <Link href={`/poptavky?${new URLSearchParams({ moje: "1", ...(region && { kraj: region }), ...(city && { misto: city }), ...(days && { stari: days }) })}`}
              aria-current={onlyMine ? "true" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-[14px] font-semibold ${onlyMine ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}>Moje obory</Link>
          </div>
        ) : (
          <p className="text-[14px] text-muted">
            Tip: <Link href="/app/nastaveni#profese" className="font-semibold text-accent-ink underline">vyberte si v nastavení až 5 profesí</Link> a uvidíte jen poptávky ze svých oborů.
          </p>
        ))}

        <p className="text-[14px] text-muted" aria-live="polite">
          {list.total === 0 ? "Žádná aktivní poptávka" : list.total === 1 ? "1 aktivní poptávka" : list.total < 5 ? `${list.total} aktivní poptávky` : `${list.total} aktivních poptávek`}
          {filtered && <> · <Link href="/poptavky" className="font-semibold text-accent-ink underline">zrušit filtr</Link></>}
        </p>

        {list.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.items.map((q) => <InquiryCard key={q.id} q={q} />)}
          </div>
        ) : (
          <div className="card px-5 py-10 text-center">
            <p className="text-muted">{filtered ? "Tomuto hledání zatím žádná poptávka neodpovídá." : "Zatím tu není žádná skutečná poptávka."}</p>
            <Link href="/poptavky/nova" className="btn-primary mt-4">Zadat první poptávku</Link>
          </div>
        )}

        {list.demo.length > 0 && page === 1 && (
          <section aria-labelledby="ukazky" className="space-y-3 pt-4">
            <div>
              <h2 id="ukazky" className="font-display text-[20px] font-extrabold">Ukázkové poptávky</h2>
              <p className="text-[14px] text-muted">
                Takto budou poptávky vypadat. Nejde o skutečné zakázky a nepočítají se do čísel výše.
                Zmizí, jakmile tu bude aspoň 5 skutečných poptávek.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {list.demo.map((q) => <InquiryCard key={q.id} q={q} />)}
            </div>
          </section>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-center gap-3 text-[14px]" aria-label="Stránkování">
            {page > 1 && <Link href={href(page - 1)} className="btn-ghost">← Novější</Link>}
            <span className="num text-muted">Strana {page} z {pages}</span>
            {page < pages && <Link href={href(page + 1)} className="btn-ghost">Starší →</Link>}
          </nav>
        )}

        <aside className="card flex flex-wrap items-center justify-between gap-3 border-dashed p-5">
          <p className="text-[15px]"><strong>Jste řemeslník?</strong> Kontakty na zadavatele vidí řemeslníci a firmy s IČO ověřeným v ARES. Registrace je zdarma.</p>
          <Link href="/prihlaseni?rezim=registrace&next=/poptavky" className="btn-ghost">Registrovat se zdarma</Link>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}
