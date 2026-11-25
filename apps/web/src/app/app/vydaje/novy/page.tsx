import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { todayInPrague } from "@/lib/calendar";
import { ExpenseForm } from "../ExpenseForm";
import { formContext } from "../load";

export const metadata: Metadata = { title: "Nový výdaj" };

export default async function NewExpensePage() {
  const company = await requireStaff();
  const ctx = await formContext(company.id);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/app/vydaje" className="text-[14px] text-muted hover:text-ink">← Výdaje</Link>
        <h1 className="font-display text-[24px] font-extrabold">Nový výdaj</h1>
      </div>
      <ExpenseForm companyId={company.id} expenseId={null} initial={null} hasFile={false} jobs={ctx.jobs} ai={ctx.ai} today={todayInPrague()} vatPayer={company.vatPayer} />
    </div>
  );
}
