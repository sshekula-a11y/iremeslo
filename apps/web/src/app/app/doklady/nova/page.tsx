import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { summarizeJob } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { addDays, todayInPrague } from "@/lib/calendar";
import { prepareAdvance, prepareInvoice } from "@/lib/documents/prepare";
import { invoiceView } from "@/lib/documents/view";
import { createClient } from "@/lib/supabase/server";
import { DocumentPaper } from "@/components/DocumentPaper";
import { draftToJob } from "@/app/app/zakazky/summary";
import { IssueAdvanceForm, IssueInvoiceForm } from "./IssueForms";

export const metadata: Metadata = { title: "Vystavit doklad" };

export default async function NewDocumentPage({ searchParams }: PageProps<"/app/doklady/nova">) {
  const sp = await searchParams;
  const jobId = typeof sp.zakazka === "string" ? sp.zakazka : "";
  const type = sp.typ === "zaloha" ? "advance" : sp.typ === "faktura" ? "invoice" : null;
  if (!/^[0-9a-f-]{36}$/.test(jobId) || !type) notFound();
  const company = await requireStaff();
  const today = todayInPrague();

  const prepared = type === "invoice" ? await prepareInvoice(company, jobId) : await prepareAdvance(company, jobId, { kind: "percent", value: "30" });
  const back = <Link href={`/app/zakazky/${jobId}`} className="text-[14px] text-muted hover:text-ink">← Zakázka</Link>;
  const heading = type === "invoice" ? "Vystavit fakturu" : "Vystavit zálohovou fakturu";

  if (!prepared.ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3">{back}<h1 className="font-display text-[24px] font-extrabold">{heading}</h1></div>
        <div className="card space-y-3 p-5">
          <p className="font-semibold text-warn">{prepared.error}</p>
          <Link href={`/app/zakazky/${jobId}`} className="btn-ghost">Zpět na zakázku</Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: firm } = await supabase.from("companies").select("invoice_theme").eq("id", company.id).single();
  const p = prepared;
  const warnings = p.warnings.length > 0 && (
    <ul className="space-y-1 rounded-xl border border-[#f3d9b1] bg-accent-soft p-3 text-[14px]">
      {p.warnings.map((w) => <li key={w}>{w}</li>)}
    </ul>
  );

  if (type === "advance") {
    const s = summarizeJob(draftToJob(p.draft, company.minMarginPct));
    const payer = p.snapshot.vatMode === "standard";
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3">{back}<h1 className="font-display text-[24px] font-extrabold">{heading}</h1></div>
        <p className="text-[14px] text-muted">{p.draft.title} · {p.snapshot.customer.name} · splatnost {p.termsDays} dní</p>
        {warnings}
        <IssueAdvanceForm jobId={jobId} gross={payer ? s.gross : s.revenue.net} grossLabel={payer ? "s DPH" : ""} />
      </div>
    );
  }

  const defaultTaxable = p.draft.dateTo && p.draft.dateTo <= today ? p.draft.dateTo : today;
  const view = invoiceView(p.snapshot, {
    number: "(přidělí se)",
    issueDate: today,
    validUntil: null,
    taxableDate: defaultTaxable,
    dueDate: addDays(today, p.termsDays),
    theme: firm?.invoice_theme ?? "oranzova",
    logoUrl: null,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">{back}<h1 className="font-display text-[24px] font-extrabold">{heading}</h1></div>
      <p className="text-[14px] text-muted">Náhled faktury z uložené zakázky. Číslo, QR Platba a logo se doplní při vystavení.</p>
      {warnings}
      <IssueInvoiceForm jobId={jobId} defaultTaxableDate={defaultTaxable} minDate={addDays(today, -366)} maxDate={addDays(today, 31)} showTaxable={p.snapshot.vatPayer} />
      <DocumentPaper v={view} />
    </div>
  );
}
