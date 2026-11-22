import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { JobForm } from "../JobForm";
import { loadDraft, loadOptions } from "../load";

export const metadata: Metadata = { title: "Zakázka" };

export default async function JobPage({ params }: PageProps<"/app/zakazky/[id]">) {
  const { id } = await params;
  const company = await requireStaff();
  const [draft, { clients, employees }] = await Promise.all([loadDraft(company.id, id), loadOptions(company.id)]);
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/app/zakazky" className="text-[14px] text-muted hover:text-ink">← Zakázky</Link>
        <h1 className="truncate font-display text-[24px] font-extrabold">{draft.title}</h1>
      </div>
      <JobForm key={draft.id} initial={draft} clients={clients} employees={employees} markupPct={company.materialMarkupPct} minMarginPct={company.minMarginPct} />
    </>
  );
}
