import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { CATEGORY_LABEL } from "@/lib/inquiries";
import type { Profession } from "@/lib/professions";

export const metadata: Metadata = { title: { absolute: "Profese · Administrace iRemeslo" } };

/** Seznam stránek profesí (/remeslnici/<slug>) – přidat vlastní, upravit, skrýt. */
export default async function AdminProfessions() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_professions");
  if (error) throw new Error("Profese se nepodařilo načíst.");
  const list = (data ?? []) as Profession[];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-extrabold">Profese</h1>
          <p className="text-[14px] text-muted">Stránky /remeslnici/… pro vyhledávače. {list.length} profesí, {list.filter((p) => p.published).length} zveřejněných.</p>
        </div>
        <Link href="/ssh/profese/_nova" className="btn-primary">Přidat profesi</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[36rem] text-[14px]">
          <thead className="bg-paper text-left text-[12px] text-muted">
            <tr><th className="px-3 py-2 font-medium">Pořadí</th><th className="px-3 py-2 font-medium">Profese</th><th className="px-3 py-2 font-medium">Obor poptávek</th><th className="px-3 py-2 font-medium">Stav</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((p) => (
              <tr key={p.slug}>
                <td className="num px-3 py-2 text-muted">{p.sort}</td>
                <td className="px-3 py-2"><span className="font-semibold">{p.name}</span><span className="block text-[12px] text-muted">/remeslnici/{p.slug}</span></td>
                <td className="px-3 py-2 text-muted">{CATEGORY_LABEL[p.category] ?? p.category}</td>
                <td className="px-3 py-2">{p.published ? <span className="text-ok">Zveřejněno</span> : <span className="text-muted">Skryto</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {p.published && <Link href={`/remeslnici/${p.slug}`} className="mr-3 text-accent-ink hover:underline" target="_blank">Zobrazit</Link>}
                  <Link href={`/ssh/profese/${p.slug}`} className="font-semibold text-accent-ink hover:underline">Upravit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
