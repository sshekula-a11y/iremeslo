import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FaqList } from "@/components/FaqList";
import { InquiryCard } from "@/components/InquiryCard";
import { CATEGORY_LABEL, type InquiryList } from "@/lib/inquiries";
import { getProfession, listProfessions, publicDb } from "@/lib/professions";
import { SITE_URL } from "@/lib/site";

// Texty se mění v administraci, poptávky průběžně – stránka se obnovuje každých 5 minut.
export const revalidate = 300;

export async function generateStaticParams() {
  return (await listProfessions()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/remeslnici/[slug]">): Promise<Metadata> {
  const p = await getProfession((await params).slug);
  if (!p) return { title: "Obor nenalezen" };
  return { title: p.meta_title, description: p.meta_description, alternates: { canonical: `/remeslnici/${p.slug}` } };
}

/** Stránka profese: co řemeslník dělá, co ovlivňuje cenu, aktuální poptávky z oboru a otázky. */
export default async function ProfessionPage({ params }: PageProps<"/remeslnici/[slug]">) {
  const p = await getProfession((await params).slug);
  if (!p) notFound();

  const { data } = await publicDb().rpc("list_inquiries", { p_category: p.category, p_limit: 6 });
  const list = data as InquiryList | null;
  const items = list?.items ?? [];
  const newHref = `/poptavky/nova?obor=${p.category}`;
  const url = `${SITE_URL}/remeslnici/${p.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "iRemeslo.cz", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Řemeslníci", item: `${SITE_URL}/remeslnici` },
        { "@type": "ListItem", position: 3, name: p.name, item: url },
      ] },
      { "@type": "Service", name: p.name, serviceType: CATEGORY_LABEL[p.category] ?? p.name, areaServed: { "@type": "Country", name: "Česko" },
        provider: { "@id": `${SITE_URL}/#org` }, url, description: p.meta_description },
      ...(p.faq.length ? [{ "@type": "FAQPage", mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:pt-8">
          <nav aria-label="Drobečková navigace" className="text-[13px] text-white/60">
            <Link href="/" className="hover:text-white">Úvod</Link> › <Link href="/remeslnici" className="hover:text-white">Řemeslníci</Link> › <span className="text-white/85">{p.name}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-display text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-[44px]">
            {p.name} <span className="text-accent">– poptávka zdarma</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/80">{p.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={newHref} className="btn-primary">Zadat poptávku zdarma</Link>
            <Link href={`/poptavky?kategorie=${p.category}`} className="btn border border-white/20 text-white hover:bg-white/10">Poptávky z oboru</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5">
        <div className="grid gap-4 pt-10 md:grid-cols-2">
          {p.services.length > 0 && (
            <section className="card p-5 sm:p-6" aria-labelledby="sluzby">
              <h2 id="sluzby" className="font-display text-[21px] font-extrabold">Co můžete poptat</h2>
              <ul className="mt-3 space-y-1.5 text-[15px]">
                {p.services.map((s) => <li key={s} className="flex gap-2"><span className="text-ok" aria-hidden="true">✓</span><span>{s}</span></li>)}
              </ul>
            </section>
          )}
          {p.price_factors.length > 0 && (
            <section className="card p-5 sm:p-6" aria-labelledby="cena">
              <h2 id="cena" className="font-display text-[21px] font-extrabold">Co ovlivňuje cenu</h2>
              <ul className="mt-3 space-y-1.5 text-[15px]">
                {p.price_factors.map((s) => <li key={s} className="flex gap-2"><span className="text-accent-ink" aria-hidden="true">•</span><span>{s}</span></li>)}
              </ul>
              <p className="mt-3 text-[13px] text-muted">Konkrétní cenu vám řemeslníci napíšou v nabídce. Chtějte práci a materiál zvlášť.</p>
            </section>
          )}
        </div>

        {p.tip && (
          <p className="mt-4 rounded-2xl bg-accent-soft px-5 py-4 text-[15px]"><strong>Tip:</strong> {p.tip}</p>
        )}

        <section className="pt-12" aria-labelledby="aktualni">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="aktualni" className="font-display text-[24px] font-extrabold">Aktuální poptávky – {CATEGORY_LABEL[p.category] ?? p.name}</h2>
            {items.length > 0 && <Link href={`/poptavky?kategorie=${p.category}`} className="text-[14px] font-semibold text-accent-ink underline">Všechny →</Link>}
          </div>
          {items.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">{items.map((q) => <InquiryCard key={q.id} q={q} />)}</div>
          ) : (
            <p className="mt-3 text-[15px] text-muted">V tomto oboru teď není žádná aktivní poptávka. Zadejte první – je to zdarma a bez registrace.</p>
          )}
        </section>

        <section className="card mt-12 flex flex-wrap items-center justify-between gap-4 bg-white p-5 sm:p-6" aria-labelledby="zadat">
          <div>
            <h2 id="zadat" className="font-display text-[22px] font-extrabold">Zadat poptávku</h2>
            <p className="mt-1 text-[15px] text-muted">Zdarma a bez registrace. Obor {CATEGORY_LABEL[p.category] ?? p.name} předvyplníme.</p>
          </div>
          <Link href={newHref} className="btn-primary">Zadat poptávku zdarma</Link>
        </section>

        {p.faq.length > 0 && (
          <section className="pt-12" aria-labelledby="otazky">
            <h2 id="otazky" className="mb-3 font-display text-[24px] font-extrabold">Časté otázky</h2>
            <FaqList items={p.faq} />
          </section>
        )}

        <aside className="card my-12 flex flex-wrap items-center justify-between gap-4 border-dashed p-5">
          <p className="text-[15px]"><strong>Děláte tuto práci?</strong> Poptávky z oboru a virtuální kancelář pro vaši firmu – 30 dní zdarma.</p>
          <Link href="/pro-remeslniky" className="btn-ghost">Pro řemeslníky</Link>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}
