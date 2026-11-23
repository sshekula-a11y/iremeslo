import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { JOB_STATUSES, type JobStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Zakázky" };

export default async function JobsPage({ searchParams }: PageProps<"/app/zakazky">) {
  const company = await requireStaff();
  const sp = await searchParams;
  const status = typeof sp.stav === "string" && sp.stav in JOB_STATUSES ? (sp.stav as JobStatus) : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select("id, number, title, status, date_from, date_to, site_address, clients(name)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, "")}%,number.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: jobs } = await query;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-extrabold">Zakázky</h1>
        <Link href="/app/zakazky/nova" className="btn-primary">+ Nová zakázka</Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <input className="field max-w-xs" name="q" defaultValue={q} placeholder="Hledat název nebo číslo" aria-label="Hledat" />
        <select className="field w-auto" name="stav" defaultValue={status ?? ""} aria-label="Stav">
          <option value="">Všechny stavy</option>
          {Object.entries(JOB_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost">Filtrovat</button>
      </form>

      <div className="card divide-y divide-line">
        {jobs && jobs.length > 0 ? (
          jobs.map((j) => (
            <Link key={j.id} href={`/app/zakazky/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
              <div className="min-w-0">
                <p className="truncate font-semibold">{j.title}</p>
                <p className="truncate text-[13px] text-muted">
                  <span className="num">{j.number}</span> · {(j.clients as unknown as { name: string } | null)?.name ?? "Bez zákazníka"}
                  {j.date_from ? ` · ${formatDate(j.date_from)}` : ""}
                </p>
              </div>
              <StatusBadge status={j.status as JobStatus} />
            </Link>
          ))
        ) : (
          <p className="px-4 py-10 text-center text-muted">{q || status ? "Nic nenalezeno." : "Zatím tu není žádná zakázka."}</p>
        )}
      </div>
    </div>
  );
}
