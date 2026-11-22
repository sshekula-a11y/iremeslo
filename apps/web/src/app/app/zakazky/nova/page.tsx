import type { Metadata } from "next";
import { requireStaff } from "@/lib/data";
import { JobForm } from "../JobForm";
import { emptyDraft, loadOptions } from "../load";

export const metadata: Metadata = { title: "Nová zakázka" };

export default async function NewJobPage() {
  const company = await requireStaff();
  const { clients, employees, catalog } = await loadOptions(company.id);
  return (
    <>
      <h1 className="mb-4 font-display text-[26px] font-extrabold">Nová zakázka</h1>
      <JobForm initial={emptyDraft(company)} clients={clients} employees={employees} catalog={catalog} markupPct={company.materialMarkupPct} minMarginPct={company.minMarginPct} />
    </>
  );
}
