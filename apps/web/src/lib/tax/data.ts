import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Daňová evidence za rok (OSVČ, příjmy a výdaje podle zaplacení):
 * - příjmy = platby vydaných faktur a záloh zaplacené v roce (plátce DPH bez DPH) + převzaté faktury z jiného programu,
 * - výdaje = výdaje a účtenky s datem v roce (plátce DPH bez DPH, je-li uvedený základ),
 * - obrat pro DPH = vystavené faktury v roce (pro hlídání povinné registrace).
 */
export interface IncomeRow { date: string; doc: string; customer: string; amount: number; assumed?: boolean }
export interface ExpenseRow { date: string; supplier: string; doc: string; category: string; amount: number }
export interface YearData {
  income: number;
  /** část příjmů z převzatých faktur bez data úhrady (počítáme, že byly zaplacené v roce vystavení) */
  incomeAssumed: number;
  expenses: number;
  byCategory: Record<string, number>;
  monthly: { income: number; expenses: number }[];
  turnover: number;
  incomeRows: IncomeRow[];
  expenseRows: ExpenseRow[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function yearData(companyId: string, year: number, vatPayer: boolean): Promise<YearData> {
  const supabase = await createClient();
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const [pay, imp, exp, inv] = await Promise.all([
    supabase.from("payments")
      .select("paid_on, amount, documents(type, number, vat_mode, customer:snapshot->customer->>name, recap:snapshot->recap, rate:snapshot->advanceVatRate)")
      .eq("company_id", companyId).gte("paid_on", from).lte("paid_on", to).limit(5000),
    supabase.from("imported_invoices").select("number, kind, issue_date, paid_on, total, currency, customer_name")
      .eq("company_id", companyId).or(`and(paid_on.gte.${from},paid_on.lte.${to}),and(paid_on.is.null,issue_date.gte.${from},issue_date.lte.${to})`).limit(5000),
    supabase.from("expenses").select("issue_date, total, vat_base, currency, category, supplier_name, doc_number")
      .eq("company_id", companyId).gte("issue_date", from).lte("issue_date", to).limit(5000),
    supabase.from("documents").select("type, status, total:snapshot->total")
      .eq("company_id", companyId).in("type", ["invoice", "invoice_non_payer"]).not("number", "is", null).neq("status", "canceled")
      .gte("issue_date", from).lte("issue_date", to).limit(5000),
  ]);

  const monthly = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0 }));
  const incomeRows: IncomeRow[] = [];
  let income = 0, incomeAssumed = 0;

  type Doc = { type: string; number: string; vat_mode: string; customer: string | null; recap: { base: number; total: number }[] | null; rate: number | null };
  for (const p of (pay.data ?? []) as unknown as { paid_on: string; amount: string; documents: Doc | null }[]) {
    const d = p.documents;
    if (!d || !["invoice", "invoice_non_payer", "advance"].includes(d.type)) continue;
    let amount = Number(p.amount);
    if (vatPayer && d.vat_mode === "standard") {
      const recap = Array.isArray(d.recap) ? d.recap : [];
      const gross = recap.reduce((s, x) => s + x.total, 0);
      if (gross > 0) amount = amount * (recap.reduce((s, x) => s + x.base, 0) / gross);
      else if (d.type === "advance" && d.rate) amount = amount / (1 + Number(d.rate) / 100);
    }
    amount = r2(amount);
    income += amount;
    monthly[Number(p.paid_on.slice(5, 7)) - 1].income += amount;
    incomeRows.push({ date: p.paid_on, doc: d.number, customer: d.customer ?? "", amount });
  }
  for (const i of (imp.data ?? []) as { number: string; kind: string; issue_date: string | null; paid_on: string | null; total: string; currency: string; customer_name: string | null }[]) {
    if (i.currency !== "CZK") continue;
    const date = i.paid_on ?? i.issue_date;
    if (!date) continue;
    const amount = Number(i.total);
    income += amount;
    if (!i.paid_on) incomeAssumed += amount;
    monthly[Number(date.slice(5, 7)) - 1].income += amount;
    incomeRows.push({ date, doc: i.number, customer: i.customer_name ?? "", amount, assumed: !i.paid_on });
  }

  const byCategory: Record<string, number> = {};
  const expenseRows: ExpenseRow[] = [];
  let expenses = 0;
  for (const e of (exp.data ?? []) as { issue_date: string; total: string; vat_base: string | null; currency: string; category: string; supplier_name: string; doc_number: string | null }[]) {
    if (e.currency !== "CZK") continue;
    const amount = vatPayer && e.vat_base != null ? Number(e.vat_base) : Number(e.total);
    expenses += amount;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + amount;
    monthly[Number(e.issue_date.slice(5, 7)) - 1].expenses += amount;
    expenseRows.push({ date: e.issue_date, supplier: e.supplier_name, doc: e.doc_number ?? "", category: e.category, amount });
  }

  let turnover = 0;
  for (const d of (inv.data ?? []) as { total: number | null }[]) turnover += Number(d.total ?? 0) / 100;
  for (const i of (imp.data ?? []) as { kind: string; issue_date: string | null; total: string; currency: string }[]) {
    if (i.kind === "invoice" && i.currency === "CZK" && i.issue_date && i.issue_date >= from && i.issue_date <= to) turnover += Number(i.total);
  }

  incomeRows.sort((a, b) => a.date.localeCompare(b.date));
  expenseRows.sort((a, b) => a.date.localeCompare(b.date));
  return { income: r2(income), incomeAssumed: r2(incomeAssumed), expenses: r2(expenses), byCategory, monthly, turnover: r2(turnover), incomeRows, expenseRows };
}
