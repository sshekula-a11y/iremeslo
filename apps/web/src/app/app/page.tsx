import { DataLayerEvent } from "@/components/DataLayerEvent";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { JOB_STATUSES, type JobStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { formatCzk } from "@iremeslo/core";
import { toHundredths } from "@/lib/money";
import { todayInPrague } from "@/lib/calendar";

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const { firma } = await searchParams;
  const company = await requireStaff();
  const supabase = await createClient();

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const todayIso = todayInPrague();
  const [{ data: jobs }, { count: inquiries }, { data: open }] = await Promise.all([
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
    supabase
      .from("documents")
      .select("total_due, due_date")
      .eq("company_id", company.id)
      .in("type", ["invoice", "invoice_non_payer", "advance"])
      .in("status", ["issued", "sent"]),
  ]);
  const unpaid = (open ?? []).reduce((sum, d) => sum + toHundredths(d.total_due), 0);
  const overdue = (open ?? []).filter((d) => d.due_date && d.due_date < todayIso).reduce((sum, d) => sum + toHundredths(d.total_due), 0);

  return (
    <div className="space-y-5">
      {firma === "nova" && <DataLayerEvent name="company_registered" />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{company.name}</p>
          <h1 className="font-display text-[26px] font-extrabold">Přehled</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/zakazky/nova" className="btn-ghost">+ Nová zakázka</Link>
          <Link href="/app/faktury/rychla" className="btn-primary">+ Vystavit fakturu</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Zakázky tento týden" value={String(jobs?.length ?? 0)} />
        <Stat label="Poptávky a nabídky" value={String(inquiries ?? 0)} />
        <Stat label="Čeká na platbu" value={formatCzk(unpaid)} href="/app/faktury?f=nezaplacene" />
        <Stat label="Po splatnosti" value={formatCzk(overdue)} href="/app/faktury?f=po-splatnosti" bad={overdue > 0} />
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
                      {(j.clients as unknown as { name: string } | null)?.name ?? "Bez zákazníka"} · {formatDate(j.date_from)} – {formatDate(j.date_to)}
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

function Stat({ label, value, href, bad }: { label: string; value: string; href?: string; bad?: boolean }) {
  const body = (
    <>
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`num font-display text-[22px] font-extrabold sm:text-[26px] ${bad ? "text-warn" : ""}`}>{value}</p>
    </>
  );
  return href ? <Link href={href} className="card block px-4 py-3 hover:border-ink/30">{body}</Link> : <div className="card px-4 py-3">{body}</div>;
}
