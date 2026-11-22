import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { JOB_STATUSES, type JobStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

export default async function Dashboard() {
  const company = await requireStaff();
  const supabase = await createClient();

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [{ data: jobs }, { count: inquiries }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, number, title, status, date_from, date_to, clients(name)")
      .eq("company_id", company.id)
      .lte("date_from", iso(in7))
      .gte("date_to", iso(today))
      .not("status", "in", "(rejected,paid)")
      .order("date_from"),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .in("status", ["inquiry", "quote_sent"]),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{company.name}</p>
          <h1 className="font-display text-[26px] font-extrabold">Přehled</h1>
        </div>
        <Link href="/app/zakazky/nova" className="btn-primary">+ Nová zakázka</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Zakázky tento týden" value={String(jobs?.length ?? 0)} />
        <Stat label="Poptávky a nabídky" value={String(inquiries ?? 0)} />
      </div>

      <section className="card">
        <h2 className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Tento týden</h2>
        {jobs && jobs.length > 0 ? (
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/app/zakazky/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{j.title}</p>
                    <p className="text-[13px] text-muted">
                      {(j.clients as unknown as { name: string } | null)?.name ?? "Bez klienta"} · {formatDate(j.date_from)} – {formatDate(j.date_to)}
                    </p>
                  </div>
                  <StatusBadge status={j.status as JobStatus} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-muted">Na tento týden nemáte naplánovanou žádnou zakázku.</p>
            <Link href="/app/zakazky/nova" className="btn-ghost mt-3">Založit první zakázku</Link>
          </div>
        )}
      </section>
      <p className="text-[13px] text-muted">Stavy zakázek: {Object.values(JOB_STATUSES).join(" → ")}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="num font-display text-[26px] font-extrabold">{value}</p>
    </div>
  );
}
