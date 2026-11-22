import "server-only";
import { notFound } from "next/navigation";
import type { QuoteSnapshot } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";
import { quoteView, type DocumentView } from "./view";

export const DOC_TYPE_LABELS: Record<string, string> = {
  quote: "Cenová nabídka",
  advance: "Zálohová faktura",
  ddpp: "Daňový doklad k platbě",
  invoice: "Faktura",
  invoice_non_payer: "Faktura",
  credit_note: "Opravný doklad",
  contract: "Smlouva o dílo",
  handover: "Předávací protokol",
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  draft: "Koncept",
  issued: "Vystaveno",
  sent: "Odesláno",
  paid: "Zaplaceno",
  canceled: "Stornováno",
};

export interface LoadedDocument {
  id: string;
  type: string;
  number: string;
  status: string;
  jobId: string | null;
  view: DocumentView;
}

export async function loadDocument(companyId: string, id: string): Promise<LoadedDocument> {
  const supabase = await createClient();
  const [{ data: d }, { data: firm }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, type, number, status, job_id, issue_date, valid_until, snapshot")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("companies").select("invoice_theme, logo_path").eq("id", companyId).single(),
  ]);
  if (!d || !d.number || d.type !== "quote") notFound();

  let logoUrl: string | null = null;
  if (firm?.logo_path) {
    const { data } = await supabase.storage.from("files").createSignedUrl(firm.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  return {
    id: d.id,
    type: d.type,
    number: d.number,
    status: d.status,
    jobId: d.job_id,
    view: quoteView(d.snapshot as QuoteSnapshot, {
      number: d.number,
      issueDate: d.issue_date,
      validUntil: d.valid_until,
      theme: firm?.invoice_theme ?? "oranzova",
      logoUrl,
    }),
  };
}

/** Doklady k zakázce (nejnovější první). */
export async function listJobDocuments(companyId: string, jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, type, number, status, issue_date, total_due")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .not("number", "is", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}
