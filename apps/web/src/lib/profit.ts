import "server-only";
import { summarizeJob, type Job, type Scenario } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";
import { toHundredths } from "@/lib/money";
import type { ActiveCompany } from "@/lib/data";
import type { JobStatus } from "@/lib/labels";

/**
 * Ziskovost zakázek – stejné vzorce jako souhrn v zakázce (balíček @iremeslo/core), nic se nepočítá jinak.
 * Počítají se zakázky, které zákazník odsouhlasil (Schváleno → Zaplaceno). U dokončených se bere skutečnost,
 * kde je zapsaná, jinak plán. Zakázka patří do měsíce podle data dokončení (nebo zahájení, nebo založení).
 */
export const COUNTED: JobStatus[] = ["approved", "in_progress", "done", "invoiced", "paid"];
const ACTUAL: JobStatus[] = ["done", "invoiced", "paid"];

export interface JobProfit {
  id: string; number: string | null; title: string; client: string | null; status: JobStatus;
  date: string; month: string; scenario: Scenario;
  net: number; materials: number; labor: number; expenses: number; costs: number;
  profit: number; marginBp: number | null; lowMargin: boolean; missingActuals: number;
}

export interface ProfitTotals { count: number; net: number; materials: number; labor: number; expenses: number; costs: number; profit: number; marginBp: number | null }

const h = toHundredths;

/** Zakázky s datem v rozmezí [from, to] (YYYY-MM-DD). */
export async function loadJobProfits(company: ActiveCompany, from: string, to: string): Promise<JobProfit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, number, title, status, date_from, date_to, created_at, vat_mode, vat_rate, discount_kind, discount_value, clients(name)," +
        "job_work_items(qty, unit, unit_price)," +
        "job_materials(qty_planned, qty_actual, unit, purchase_price, sale_price, billable)," +
        "job_labor(qty_planned, qty_actual, unit, rate)," +
        "job_expenses(qty_planned, qty_actual, unit_price)",
    )
    .eq("company_id", company.id)
    .in("status", COUNTED)
    .limit(5000);
  const minMarginBp = h(company.minMarginPct);
  const out: JobProfit[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const j of (data ?? []) as any[]) {
    const date: string = j.date_to ?? j.date_from ?? String(j.created_at).slice(0, 10);
    if (date < from || date > to) continue;
    const opt = (v: unknown) => (v === null || v === undefined ? null : h(v as string));
    const job: Job = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      work: j.job_work_items.map((w: any) => ({ description: "", qty: h(w.qty), unit: w.unit, unitPrice: h(w.unit_price) })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      materials: j.job_materials.map((m: any) => ({ description: "", qtyPlanned: h(m.qty_planned), qtyActual: opt(m.qty_actual), unit: m.unit,
        purchasePrice: h(m.purchase_price), salePrice: h(m.sale_price), billable: m.billable })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labor: j.job_labor.map((l: any) => ({ name: "", qtyPlanned: h(l.qty_planned), qtyActual: opt(l.qty_actual), unit: l.unit, rate: h(l.rate) })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expenses: j.job_expenses.map((e: any) => ({ description: "", qtyPlanned: h(e.qty_planned), qtyActual: opt(e.qty_actual), unitPrice: h(e.unit_price) })),
      discount: j.discount_kind === "percent" ? { kind: "percent", bp: Math.min(10_000, Math.max(0, h(j.discount_value))) }
        : j.discount_kind === "amount" ? { kind: "amount", amount: Math.max(0, h(j.discount_value)) } : null,
      vatMode: j.vat_mode, vatRate: j.vat_rate, minMarginBp,
    };
    const scenario: Scenario = ACTUAL.includes(j.status) ? "actual" : "plan";
    let s;
    try { s = summarizeJob(job, scenario); } catch { continue; } // např. sleva vyšší než cena – zakázka se v přehledu vynechá
    out.push({
      id: j.id, number: j.number, title: j.title, client: j.clients?.name ?? null, status: j.status, date, month: date.slice(0, 7), scenario,
      net: s.revenue.net, materials: s.costs.materials, labor: s.costs.labor, expenses: s.costs.expenses, costs: s.costs.total,
      profit: s.profit, marginBp: s.marginBp, lowMargin: s.lowMargin, missingActuals: s.missingActuals,
    });
  }
  return out;
}

export function totals(list: JobProfit[]): ProfitTotals {
  const t = list.reduce((a, j) => ({ count: a.count + 1, net: a.net + j.net, materials: a.materials + j.materials, labor: a.labor + j.labor,
    expenses: a.expenses + j.expenses, costs: a.costs + j.costs, profit: a.profit + j.profit }),
    { count: 0, net: 0, materials: 0, labor: 0, expenses: 0, costs: 0, profit: 0 });
  return { ...t, marginBp: t.net === 0 ? null : Math.round((t.profit * 10_000) / t.net) };
}
