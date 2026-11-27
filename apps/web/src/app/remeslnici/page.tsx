import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORY_LABEL } from "@/lib/inquiries";
import { listProfessions } from "@/lib/professions";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Řemeslníci podle oboru – poptávka zdarma",
  description: "Instalatér, elektrikář, pokrývač, malíř, obkladač a další obory. Vyberte řemeslo, přečtěte si, na co se připravit, a zadejte poptávku zdarma.",
  alternates: { canonical: "/remeslnici" },
};

export default async function ProfessionsIndex() {
  const list = await listProfessions();
  return (
    <main>
      <JsonLd trail={[["Řemeslníci", "/remeslnici"]]} />
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <h1 className="font-display text-[32px] font-extrabold leading-tight sm:text-[40px]">Řemeslníci podle oboru</h1>
        <p className="mt-2 max-w-2xl text-[17px] text-muted">
          Vyberte obor, zjistěte, co ovlivňuje cenu a na co se připravit, a zadejte poptávku zdarma. Kontakt na vás uvidí jen firmy s IČO ověřeným v ARES.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <li key={p.slug}>
              <Link href={`/remeslnici/${p.slug}`} className="card group flex h-full flex-col p-4 hover:border-ink/30">
                <span className="font-display text-[17px] font-bold group-hover:text-accent-ink">{p.name}</span>
                <span className="text-[13px] text-muted">{CATEGORY_LABEL[p.category] ?? p.category}</span>
              </Link>
            </li>
          ))}
        </ul>
        <aside className="card mt-10 flex flex-wrap items-center justify-between gap-4 border-dashed p-5">
          <p className="text-[16px]"><strong>Nenašli jste svůj obor?</strong> Poptávku zadáte i tak – zvolte obor „Jiné“.</p>
          <Link href="/poptavky/nova" className="btn-primary">Zadat poptávku zdarma</Link>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}
