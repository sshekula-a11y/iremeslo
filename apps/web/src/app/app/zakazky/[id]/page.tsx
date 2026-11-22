import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { JobForm } from "../JobForm";
import { loadDraft, loadOptions } from "../load";
import { DOC_STATUS_LABELS, DOC_TYPE_LABELS, listJobDocuments } from "@/lib/documents/load";
import { czk, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Zakázka" };

export default async function JobPage({ params }: PageProps<"/app/zakazky/[id]">) {
  const { id } = await params;
  const company = await requireStaff();
  const [draft, { clients, employees, catalog }, documents] = await Promise.all([loadDraft(company.id, id), loadOptions(company.id), listJobDocuments(company.id, id)]);
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/app/zakazky" className="text-[14px] text-muted hover:text-ink">← Zakázky</Link>
        <h1 className="truncate font-display text-[24px] font-extrabold">{draft.title}</h1>
      </div>
      {documents.length > 0 && (
        <section className="card mb-5" aria-label="Doklady k zakázce">
          <h2 className="border-b border-line px-4 py-2.5 text-[14px] font-semibold text-muted">Doklady k zakázce</h2>
          <ul className="divide-y divide-line">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link href={`/app/doklady/${doc.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 hover:bg-paper">
                  <span className="font-semibold">{DOC_TYPE_LABELS[doc.type] ?? doc.type} <span className="num">{doc.number}</span></span>
                  <span className="num text-[13px] text-muted">
                    {formatDate(doc.issue_date)} · {czk(doc.total_due)} · {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <JobForm key={draft.id} initial={draft} clients={clients} employees={employees} catalog={catalog} markupPct={company.materialMarkupPct} minMarginPct={company.minMarginPct} />
    </>
  );
}
