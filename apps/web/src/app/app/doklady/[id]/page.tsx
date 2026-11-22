import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { DOC_STATUS_LABELS, loadDocument } from "@/lib/documents/load";
import { DocumentPaper } from "@/components/DocumentPaper";
import { PdfDownload } from "@/components/PdfDownload";

export const metadata: Metadata = { title: "Doklad" };

export default async function DocumentPage({ params }: PageProps<"/app/doklady/[id]">) {
  const { id } = await params;
  const company = await requireStaff();
  const doc = await loadDocument(company.id, id);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {doc.jobId && <Link href={`/app/zakazky/${doc.jobId}`} className="text-[14px] text-muted hover:text-ink">← Zakázka</Link>}
          <h1 className="truncate font-display text-[24px] font-extrabold">{doc.view.heading} {doc.number}</h1>
          <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[12px] font-semibold text-muted ring-1 ring-line">{DOC_STATUS_LABELS[doc.status] ?? doc.status}</span>
        </div>
        <PdfDownload view={doc.view} fileName={`${doc.type === "quote" ? "Nabidka" : "Doklad"}-${doc.number}.pdf`} />
      </div>
      <p className="text-[13px] text-muted">Vystavený doklad už nejde měnit. Když se cena změní, upravte zakázku a vystavte novou nabídku.</p>
      <DocumentPaper v={doc.view} />
    </div>
  );
}
