import "server-only";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { buildSpayd, variableSymbol, type InvoiceSnapshot, type QuoteSnapshot } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";
import { invoiceView, quoteView, type DocumentView } from "./view";
import { contractView, handoverView, type ContractSnapshot, type HandoverSnapshot } from "./contract";
import {
  amendmentView, cashView, claimView, deliveryView, reminderView,
  type AmendmentSnapshot, type CashSnapshot, type ClaimSnapshot, type DeliverySnapshot, type ReminderSnapshot,
} from "./extra";

export const DOC_TYPE_LABELS: Record<string, string> = {
  quote: "Cenová nabídka",
  advance: "Zálohová faktura",
  ddpp: "Daňový doklad k platbě",
  invoice: "Faktura",
  invoice_non_payer: "Faktura",
  credit_note: "Opravný doklad",
  contract: "Smlouva o dílo",
  handover: "Předávací protokol",
  delivery: "Dodací list",
  cash_in: "Příjmový pokladní doklad",
  cash_out: "Výdajový pokladní doklad",
  reminder: "Upomínka",
  claim: "Reklamační protokol",
  amendment: "Dodatek ke smlouvě",
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  draft: "Koncept",
  issued: "Vystaveno",
  sent: "Odesláno",
  paid: "Zaplaceno",
  canceled: "Stornováno",
};

export const INVOICE_TYPES = ["invoice", "invoice_non_payer", "advance", "ddpp"] as const;
export const AGREEMENT_TYPES = ["contract", "handover", "delivery", "cash_in", "cash_out", "reminder", "claim", "amendment"] as const;

export interface RelatedDocument { id: string; type: string; number: string; status: string }

export interface LoadedDocument {
  id: string;
  type: string;
  number: string;
  status: string;
  jobId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  totalDue: string;
  snapshot: QuoteSnapshot | InvoiceSnapshot | ContractSnapshot | HandoverSnapshot | DeliverySnapshot | CashSnapshot | ReminderSnapshot | ClaimSnapshot | AmendmentSnapshot;
  view: DocumentView;
  payments: { paid_on: string; amount: string; method: string }[];
  /** záloha → její DDPP; DDPP → jeho záloha; záloha → faktura, na které je odečtená */
  related: RelatedDocument[];
}

/** QR Platba jako obrázek (PNG data URL) – vykreslí se stejně v náhledu i v PDF. */
async function qrPayment(s: InvoiceSnapshot, number: string, dueDate: string | null): Promise<string | null> {
  if (s.kind === "ddpp" || !s.payment?.iban || s.amountDue <= 0) return null;
  try {
    const spayd = buildSpayd({
      iban: s.payment.iban,
      bic: s.payment.bic ?? undefined,
      amount: s.amountDue,
      variableSymbol: variableSymbol(number),
      dueDate: dueDate ?? undefined,
      message: `${s.kind === "advance" ? "Zaloha" : "Faktura"} ${number}`,
      recipientName: s.supplier.name,
    });
    return await QRCode.toDataURL(spayd, { errorCorrectionLevel: "M", margin: 0, width: 360 });
  } catch {
    return null;
  }
}

export async function loadDocument(companyId: string, id: string): Promise<LoadedDocument> {
  const supabase = await createClient();
  const [{ data: d }, { data: firm }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, type, number, status, job_id, issue_date, taxable_date, due_date, valid_until, total_due, related_document_id, snapshot, payments(paid_on, amount, method)")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("companies").select("invoice_theme, logo_path, stamp_path, signature_path").eq("id", companyId).single(),
  ]);
  if (!d || !d.number) notFound();
  const isQuote = d.type === "quote";
  const isAgreement = (AGREEMENT_TYPES as readonly string[]).includes(d.type);
  if (!isQuote && !isAgreement && !(INVOICE_TYPES as readonly string[]).includes(d.type)) notFound();

  // Obrázky leží v soukromém úložišti; odkaz platí hodinu (na náhled i vytvoření PDF stačí).
  const paths = [firm?.logo_path, firm?.stamp_path, firm?.signature_path].filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("files").createSignedUrls(paths, 60 * 60);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  const url = (p: string | null | undefined) => (p ? signed.get(p) ?? null : null);

  const meta = {
    number: d.number,
    issueDate: d.issue_date,
    validUntil: d.valid_until,
    taxableDate: d.taxable_date,
    dueDate: d.due_date,
    theme: firm?.invoice_theme ?? "oranzova",
    logoUrl: url(firm?.logo_path),
    stampUrl: url(firm?.stamp_path),
    signatureUrl: url(firm?.signature_path),
  };
  let view: DocumentView;
  if (isQuote) {
    view = quoteView(d.snapshot as QuoteSnapshot, meta);
  } else if (d.type === "contract") {
    view = contractView(d.snapshot as ContractSnapshot, meta);
  } else if (d.type === "handover") {
    view = handoverView(d.snapshot as HandoverSnapshot, meta);
  } else if (d.type === "delivery") {
    view = deliveryView(d.snapshot as DeliverySnapshot, meta);
  } else if (d.type === "cash_in" || d.type === "cash_out") {
    view = cashView(d.snapshot as CashSnapshot, meta);
  } else if (d.type === "reminder") {
    view = reminderView(d.snapshot as ReminderSnapshot, meta);
  } else if (d.type === "claim") {
    view = claimView(d.snapshot as ClaimSnapshot, meta);
  } else if (d.type === "amendment") {
    view = amendmentView(d.snapshot as AmendmentSnapshot, meta);
  } else {
    const snap = d.snapshot as InvoiceSnapshot;
    view = invoiceView(snap, { ...meta, qrDataUrl: await qrPayment(snap, d.number, d.due_date) });
  }

  // Navázané doklady
  const related: RelatedDocument[] = [];
  if (d.type === "advance") {
    const [{ data: ddpp }, { data: ded }] = await Promise.all([
      supabase.from("documents").select("id, type, number, status").eq("company_id", companyId).eq("related_document_id", d.id).not("number", "is", null),
      supabase.from("advance_deductions").select("invoice_id").eq("company_id", companyId).eq("advance_id", d.id),
    ]);
    for (const r of ddpp ?? []) related.push(r as RelatedDocument);
    const invoiceIds = (ded ?? []).map((r) => r.invoice_id as string);
    if (invoiceIds.length) {
      const { data: invs } = await supabase.from("documents").select("id, type, number, status").eq("company_id", companyId).in("id", invoiceIds).not("number", "is", null);
      for (const r of invs ?? []) related.push(r as RelatedDocument);
    }
  }
  if (d.type === "contract" || d.type === "invoice" || d.type === "invoice_non_payer") {
    const { data: pp } = await supabase.from("documents").select("id, type, number, status").eq("company_id", companyId).eq("related_document_id", d.id).not("number", "is", null);
    for (const r of pp ?? []) related.push(r as RelatedDocument);
  }
  if (d.related_document_id) {
    const { data: adv } = await supabase.from("documents").select("id, type, number, status").eq("company_id", companyId).eq("id", d.related_document_id).single();
    if (adv) related.push(adv as RelatedDocument);
  }

  return {
    id: d.id,
    type: d.type,
    number: d.number,
    status: d.status,
    jobId: d.job_id,
    issueDate: d.issue_date,
    dueDate: d.due_date,
    totalDue: String(d.total_due),
    snapshot: d.snapshot as LoadedDocument["snapshot"],
    view,
    payments: ((d as unknown as { payments: LoadedDocument["payments"] }).payments ?? []).map((p) => ({ ...p, amount: String(p.amount) })),
    related,
  };
}

/** Doklady k zakázce (nejnovější první). */
export async function listJobDocuments(companyId: string, jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, type, number, status, issue_date, due_date, total_due")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .not("number", "is", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}
