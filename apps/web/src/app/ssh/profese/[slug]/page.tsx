import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { INQUIRY_CATEGORIES } from "@/lib/inquiries";
import type { Profession } from "@/lib/professions";
import { ActionForm } from "../../ActionForm";
import { deleteProfession, saveProfession } from "../../actions";

export const metadata: Metadata = { title: { absolute: "Profese · Administrace iRemeslo" } };

const EMPTY: Profession = { slug: "", name: "", category: "jine", meta_title: "", meta_description: "", intro: "", services: [], price_factors: [], tip: "", faq: [], published: true, sort: 100 };

/** Úprava profese; adresa „_nova“ = nová profese. */
export default async function EditProfession({ params, searchParams }: PageProps<"/ssh/profese/[slug]">) {
  const { slug } = await params;
  const { ulozeno } = await searchParams;
  const { supabase } = await requireAdmin();
  const isNew = slug === "_nova";
  let p = EMPTY;
  if (!isNew) {
    const { data } = await supabase.rpc("admin_professions");
    const found = ((data ?? []) as Profession[]).find((x) => x.slug === slug);
    if (!found) notFound();
    p = found;
  }
  const faqText = p.faq.map((f) => `${f.q}\n${f.a}`).join("\n\n");

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/ssh/profese" className="text-[14px] text-muted hover:text-ink">← Profese</Link>
      <h1 className="font-display text-[26px] font-extrabold">{isNew ? "Nová profese" : p.name}</h1>
      {ulozeno === "1" && <p className="rounded-xl bg-ok-soft px-3 py-2 text-[14px] text-ok">Uloženo.</p>}

      <ActionForm action={saveProfession} submit={isNew ? "Přidat profesi" : "Uložit změny"} tone="primary" className="card space-y-4 p-4 sm:p-5">
        <input type="hidden" name="original" value={isNew ? "" : p.slug} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Název (H1 a seznamy)" name="name" value={p.name} required placeholder="např. Kominík" />
          <Field label="Adresa: /remeslnici/…" name="slug" value={p.slug} required placeholder="kominik" hint="Malá písmena bez diakritiky a pomlčky. Změna adresy rozbije staré odkazy." />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div>
            <label className="label" htmlFor="category">Obor poptávek (výpis poptávek a předvyplnění formuláře)</label>
            <select className="field" id="category" name="category" defaultValue={p.category}>
              {INQUIRY_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <Field label="Pořadí" name="sort" value={String(p.sort)} inputMode="numeric" />
        </div>
        <Field label="Titulek pro Google (10–90 znaků)" name="meta_title" value={p.meta_title} required placeholder="Kominík – čištění komínů, poptávka zdarma" />
        <Area label="Popis pro Google (50–200 znaků)" name="meta_description" value={p.meta_description} rows={2} />
        <Area label="Úvodní text" name="intro" value={p.intro} rows={5} />
        <Area label="Co můžete poptat – jedna položka na řádek" name="services" value={p.services.join("\n")} rows={6} />
        <Area label="Co ovlivňuje cenu – jedna položka na řádek (bez částek)" name="price_factors" value={p.price_factors.join("\n")} rows={5} />
        <Area label="Tip (nepovinné)" name="tip" value={p.tip ?? ""} rows={2} />
        <Area label="Časté otázky – první řádek otázka, další odpověď; otázky oddělte prázdným řádkem" name="faq" value={faqText} rows={8} />
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" name="published" defaultChecked={p.published !== false} className="size-5 accent-accent" /> Zveřejněno na webu
        </label>
      </ActionForm>

      {!isNew && (
        <ActionForm action={deleteProfession} submit="Smazat profesi" tone="danger" className="card space-y-2 border-warn/30 p-4">
          <input type="hidden" name="slug" value={p.slug} />
          <p className="text-[14px] text-muted">Stránka /remeslnici/{p.slug} zmizí z webu. Místo smazání ji můžete jen skrýt.</p>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="confirm" className="size-5" /> Opravdu smazat</label>
        </ActionForm>
      )}
    </div>
  );
}

function Field({ label, name, value, hint, ...rest }: { label: string; name: string; value: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="field" id={name} name={name} defaultValue={value} {...rest} />
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

function Area({ label, name, value, rows }: { label: string; name: string; value: string; rows: number }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <textarea className="field" id={name} name={name} defaultValue={value} rows={rows} />
    </div>
  );
}
