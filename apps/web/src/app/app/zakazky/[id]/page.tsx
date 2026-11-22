import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { JobForm } from "../JobForm";
import { loadDraft, loadOptions } from "../load";
import { DOC_TYPE_LABELS, listJobDocuments } from "@/lib/documents/load";
import { czk, formatDate } from "@/lib/format";
import { todayInPrague } from "@/lib/calendar";
import { DocStatusBadge, docState } from "@/components/DocStatusBadge";

export const metadata: Metadata = { title: "Zakázka" };

export default async function JobPage({ params }: PageProps<"/app/zakazky/[id]">) {
  const { id } = await params;
  const company = await requireStaff();
  const [draft, { clients, employees, catalog }, documents] = await Promise.all([loadDraft(company.id, id), loadOptions(company.id), listJobDocuments(company.id, id)]);
  const today = todayInPrague();
  const invoiced = documents.some((d) => (d.type === "invoice" || d.type === "invoice_non_payer") && d.status !== "canceled");

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/app/zakazky" className="text-[14px] text-muted hover:text-ink">← Zakázky</Link>
        <h1 className="truncate font-display text-[24px] font-extrabold">{draft.title}</h1>
      </div>

      <section className="card mb-5" aria-label="Doklady a fakturace">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-[14px] font-semibold text-muted">Doklady a fakturace</h2>
          {!invoiced && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/app/doklady/nova?zakazka=${id}&typ=zaloha`} className="btn-ghost min-h-9 px-3 text-[14px]">Vystavit zálohu</Link>
              <Link href={`/app/doklady/nova?zakazka=${id}&typ=faktura`} className="btn-dark min-h-9 px-3 text-[14px]">Vystavit fakturu</Link>
            </div>
          )}
        </div>
        {documents.length > 0 ? (
          <ul className="divide-y divide-line">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link href={`/app/doklady/${doc.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-paper">
                  <span className="font-semibold">{DOC_TYPE_LABELS[doc.type] ?? doc.type} <span className="num">{doc.number}</span></span>
                  <span className="flex items-center gap-3">
                    <span className="num text-[13px] text-muted">{formatDate(doc.issue_date)} · {czk(doc.total_due)}</span>
                    <DocStatusBadge state={docState(doc.type, doc.status, doc.due_date, today)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-muted">Zatím žádné doklady. Nabídku vystavíte tlačítkem u souhrnu, fakturu a zálohu tady nahoře. Fakturuje se uložený stav zakázky.</p>
        )}
      </section>

      <JobForm key={draft.id} initial={draft} clients={clients} employees={employees} catalog={catalog} markupPct={company.materialMarkupPct} minMarginPct={company.minMarginPct} />
    </>
  );
}
