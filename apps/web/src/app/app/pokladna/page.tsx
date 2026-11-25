import type { Metadata } from "next";
import Link from "next/link";
import { formatCzk } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { toHundredths } from "@/lib/money";
import { czk, formatDate } from "@/lib/format";
import type { CashSnapshot } from "@/lib/documents/extra";

export const metadata: Metadata = { title: "Pokladna" };

/** Pokladní kniha: příjmové a výdajové pokladní doklady a zůstatek hotovosti. */
export default async function CashBookPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("documents")
    .select("id, type, number, issue_date, total_due, snapshot")
    .eq("company_id", company.id).in("type", ["cash_in", "cash_out"]).not("number", "is", null)
    .order("issue_date", { ascending: false }).order("number", { ascending: false }).limit(500);
  const rows = data ?? [];
  const sum = (t: string) => rows.filter((r) => r.type === t).reduce((a, r) => a + toHundredths(String(r.total_due)), 0);
  const income = sum("cash_in"), outflow = sum("cash_out");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-extrabold">Pokladna</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/listiny/nova?typ=vydajovy-doklad" className="btn-ghost">− Výdaj (VPD)</Link>
          <Link href="/app/listiny/nova?typ=prijmovy-doklad" className="btn-primary">+ Příjem (PPD)</Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:max-w-2xl">
        <div className="card px-4 py-3"><p className="text-[13px] text-muted">Příjmy</p><p className="num font-display text-[20px] font-extrabold">{formatCzk(income)}</p></div>
        <div className="card px-4 py-3"><p className="text-[13px] text-muted">Výdaje</p><p className="num font-display text-[20px] font-extrabold">{formatCzk(outflow)}</p></div>
        <div className="card px-4 py-3"><p className="text-[13px] text-muted">Zůstatek</p><p className={`num font-display text-[20px] font-extrabold ${income - outflow < 0 ? "text-warn" : ""}`}>{formatCzk(income - outflow)}</p></div>
      </div>
      <div className="card divide-y divide-line">
        {rows.length === 0 && <p className="px-4 py-10 text-center text-muted">Zatím žádné pokladní doklady. Příjmový doklad vystavíte i přímo u nezaplacené faktury.</p>}
        {rows.map((r) => {
          const s = r.snapshot as CashSnapshot;
          const inc = r.type === "cash_in";
          return (
            <Link key={r.id} href={`/app/doklady/${r.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper">
              <div className="min-w-0">
                <p className="font-semibold"><span className="num">{r.number}</span> <span className="font-normal text-muted">· {inc ? "příjem" : "výdaj"} · {formatDate(r.issue_date)}</span></p>
                <p className="truncate text-[13px] text-muted">{s.counterparty?.name} · {s.purpose}</p>
              </div>
              <span className={`num font-semibold ${inc ? "text-ok" : "text-warn"}`}>{inc ? "+" : "−"}{czk(String(r.total_due))}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
