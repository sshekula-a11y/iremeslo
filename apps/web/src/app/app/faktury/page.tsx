import type { Metadata } from "next";
import Link from "next/link";
import { formatCzk } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { toHundredths } from "@/lib/money";
import { czk, formatDate } from "@/lib/format";
import { todayInPrague } from "@/lib/calendar";
import { DOC_TYPE_LABELS } from "@/lib/documents/load";
import { DocStatusBadge, docState } from "@/components/DocStatusBadge";

export const metadata: Metadata = { title: "Faktury" };

const FILTERS = [
  ["", "Vše"],
  ["nezaplacene", "Čeká na platbu"],
  ["po-splatnosti", "Po splatnosti"],
  ["zaplacene", "Zaplacené"],
] as const;

interface Row {
  id: string; type: string; number: string; status: string; issue_date: string | null; due_date: string | null;
  total_due: string; job_id: string | null; clients: { name: string } | null;
}

export default async function InvoicesPage({ searchParams }: PageProps<"/app/faktury">) {
  const company = await requireStaff();
  const { f } = await searchParams;
  const filter = typeof f === "string" ? f : "";
  const today = todayInPrague();
  const supabase = await createClient();

  let q = supabase
    .from("documents")
    .select("id, type, number, status, issue_date, due_date, total_due, job_id, clients(name)")
    .eq("company_id", company.id)
    .in("type", ["invoice", "invoice_non_payer", "advance", "ddpp"])
    .not("number", "is", null)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(300);
  if (filter === "zaplacene") q = q.eq("status", "paid");
  if (filter === "nezaplacene" || filter === "po-splatnosti") q = q.in("status", ["issued", "sent"]).neq("type", "ddpp");
  if (filter === "po-splatnosti") q = q.lt("due_date", today);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

  // Součty nezaplacených (bez ohledu na filtr)
  const { data: open } = await supabase
    .from("documents")
    .select("total_due, due_date")
    .eq("company_id", company.id)
    .in("type", ["invoice", "invoice_non_payer", "advance"])
    .in("status", ["issued", "sent"]);
  const unpaid = (open ?? []).reduce((s, d) => s + toHundredths(d.total_due), 0);
  const overdueRows = (open ?? []).filter((d) => d.due_date && d.due_date < today);
  const overdue = overdueRows.reduce((s, d) => s + toHundredths(d.total_due), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Faktury</h1>
        <p className="text-[14px] text-muted">Fakturu nebo zálohu vystavíte v detailu zakázky.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
        <div className="card px-4 py-3">
          <p className="text-[13px] text-muted">Čeká na platbu</p>
          <p className="num font-display text-[22px] font-extrabold">{formatCzk(unpaid)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[13px] text-muted">Po splatnosti{overdueRows.length ? ` (${overdueRows.length})` : ""}</p>
          <p className={`num font-display text-[22px] font-extrabold ${overdue > 0 ? "text-warn" : ""}`}>{formatCzk(overdue)}</p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto" aria-label="Filtr">
        {FILTERS.map(([key, label]) => (
          <Link key={key} href={key ? `?f=${key}` : "?"} aria-current={filter === key ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[14px] font-medium ${filter === key ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="card divide-y divide-line">
        {rows.length === 0 && <p className="px-4 py-10 text-center text-muted">{filter ? "Žádné doklady v tomto filtru." : "Zatím žádné faktury. Vystavíte je v detailu zakázky."}</p>}
        {rows.map((r) => (
          <Link key={r.id} href={`/app/doklady/${r.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper">
            <div className="min-w-0">
              <p className="font-semibold"><span className="num">{r.number}</span> <span className="font-normal text-muted">· {DOC_TYPE_LABELS[r.type]}</span></p>
              <p className="truncate text-[13px] text-muted">
                {r.clients?.name ?? "—"} · vystaveno {formatDate(r.issue_date)}{r.due_date && r.type !== "ddpp" ? ` · splatnost ${formatDate(r.due_date)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="num font-semibold">{czk(r.total_due)}</span>
              <DocStatusBadge state={docState(r.type, r.status, r.due_date, today)} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
