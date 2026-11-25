import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { todayInPrague } from "@/lib/calendar";
import { ExpenseForm } from "../ExpenseForm";
import { formContext } from "../load";
import type { ExpenseFields } from "../actions";

export const metadata: Metadata = { title: "Výdaj" };

const t = (n: string | number | null) => (n == null ? "" : Number(n).toFixed(2).replace(".", ","));

export default async function ExpensePage({ params }: PageProps<"/app/vydaje/[id]">) {
  const { id } = await params;
  const company = await requireStaff();
  const supabase = await createClient();
  const { data: e } = await supabase.from("expenses").select("*").eq("company_id", company.id).eq("id", id).maybeSingle();
  if (!e) notFound();
  const ctx = await formContext(company.id);
  const initial: ExpenseFields = {
    kind: e.kind, supplierName: e.supplier_name, supplierIco: e.supplier_ico ?? "", docNumber: e.doc_number ?? "", issueDate: e.issue_date,
    total: t(e.total), vatBase: t(e.vat_base), vat: t(e.vat), currency: e.currency, category: e.category, description: e.description ?? "",
    paidMethod: e.paid_method, jobId: e.job_id ?? "",
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/app/vydaje" className="text-[14px] text-muted hover:text-ink">← Výdaje</Link>
        <h1 className="font-display text-[24px] font-extrabold">Výdaj – {e.supplier_name}</h1>
      </div>
      <ExpenseForm companyId={company.id} expenseId={e.id} initial={initial} hasFile={!!e.file_path} jobs={ctx.jobs} ai={ctx.ai} today={todayInPrague()} vatPayer={company.vatPayer} />
    </div>
  );
}
