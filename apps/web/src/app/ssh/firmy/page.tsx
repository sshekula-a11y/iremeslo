import type { Metadata } from "next";
import Link from "next/link";
import { adminDate, requireAdmin, SUB_STATUS_LABELS } from "@/lib/admin";

export const metadata: Metadata = { title: "Firmy" };

interface Row {
  id: string; name: string; ico: string | null; created_at: string; owner_email: string | null; users: number; jobs: number; invoices: number;
  last_activity: string | null; plan_id: string | null; plan_name: string | null; sub_status: string | null; period_end: string | null; read_only: boolean;
}

export default async function AdminCompanies({ searchParams }: PageProps<"/ssh/firmy">) {
  const { supabase } = await requireAdmin();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const { data, error } = await supabase.rpc("admin_companies", { p_search: search });
  if (error) throw new Error("Firmy se nepodařilo načíst.");
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[26px] font-extrabold">Firmy <span className="text-muted">({rows.length})</span></h1>
        <form className="flex gap-2" role="search">
          <input name="q" defaultValue={search} className="field w-64" placeholder="Název, IČO nebo e-mail" aria-label="Hledat firmu" />
          <button className="btn-dark">Hledat</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[56rem] text-[14px]">
          <thead className="border-b border-line bg-paper text-left text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Firma</th>
              <th className="px-3 py-2 font-semibold">Majitel</th>
              <th className="px-3 py-2 text-right font-semibold">Lidé</th>
              <th className="px-3 py-2 text-right font-semibold">Zakázky</th>
              <th className="px-3 py-2 text-right font-semibold">Faktury</th>
              <th className="px-3 py-2 font-semibold">Aktivita</th>
              <th className="px-3 py-2 font-semibold">Tarif</th>
              <th className="px-3 py-2 font-semibold">Registrace</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-paper">
                <td className="px-3 py-2.5">
                  <Link href={`/ssh/firmy/${r.id}`} className="font-semibold text-ink hover:text-accent-ink">{r.name}</Link>
                  {r.ico && <span className="num block text-[12px] text-muted">IČO {r.ico}</span>}
                </td>
                <td className="px-3 py-2.5 text-muted">{r.owner_email ?? "—"}</td>
                <td className="num px-3 py-2.5 text-right">{r.users}</td>
                <td className="num px-3 py-2.5 text-right">{r.jobs}</td>
                <td className="num px-3 py-2.5 text-right">{r.invoices}</td>
                <td className="num px-3 py-2.5">{adminDate(r.last_activity)}</td>
                <td className="px-3 py-2.5">
                  {r.plan_name ?? "—"}
                  {r.read_only ? <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">jen čtení</span>
                    : r.sub_status && r.sub_status !== "active" ? <span className="ml-1 text-[12px] text-muted">({SUB_STATUS_LABELS[r.sub_status] ?? r.sub_status})</span> : null}
                  {r.period_end && <span className="num block text-[12px] text-muted">do {adminDate(r.period_end)}</span>}
                </td>
                <td className="num px-3 py-2.5 text-muted">{adminDate(r.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">Nic nenalezeno.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
