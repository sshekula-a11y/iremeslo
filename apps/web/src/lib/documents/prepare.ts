import "server-only";
import {
  buildAdvance, buildInvoice, DocumentError, InvoiceError, toDecimalString,
  type AdvanceToDeduct, type InvoiceSnapshot, type VatRate,
} from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";
import type { ActiveCompany } from "@/lib/data";
import { toHundredths } from "@/lib/money";
import { loadDraft } from "@/app/app/zakazky/load";
import { draftToJob } from "@/app/app/zakazky/summary";
import type { JobDraft } from "@/app/app/zakazky/types";
import { loadParties } from "./parties";

export interface PreparedDeduction { advanceId: string; advanceNumber: string; base: string; vat: string; rate: VatRate }

export type Prepared =
  | { ok: true; snapshot: InvoiceSnapshot; type: "invoice" | "invoice_non_payer" | "advance"; draft: JobDraft; deductions: PreparedDeduction[]; warnings: string[]; termsDays: number }
  | { ok: false; error: string; draft: JobDraft | null };

const message = (e: unknown, fallback: string) =>
  e instanceof DocumentError || e instanceof InvoiceError || e instanceof RangeError ? e.message : fallback;

interface JobDoc { id: string; type: string; number: string | null; status: string; total_due: string; snapshot: InvoiceSnapshot; related_document_id: string | null }

async function jobDocuments(companyId: string, jobId: string): Promise<JobDoc[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, type, number, status, total_due, snapshot, related_document_id")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .not("number", "is", null);
  return (data ?? []).map((d) => ({ ...d, total_due: String(d.total_due) })) as JobDoc[];
}

/**
 * Konečná faktura ze uložené zakázky. Najde zaplacené zálohy zakázky, které ještě nebyly odečtené,
 * a u plátce k nim vystavené DDPP (odečítá se přesně základ a daň z DDPP).
 */
export async function prepareInvoice(company: ActiveCompany, jobId: string): Promise<Prepared> {
  const draft = await loadDraft(company.id, jobId);
  const parties = await loadParties(company.id, draft.clientId || null);
  const docs = await jobDocuments(company.id, jobId);

  const existing = docs.find((d) => (d.type === "invoice" || d.type === "invoice_non_payer") && d.status !== "canceled");
  if (existing) return { ok: false, draft, error: `K zakázce už je vystavená faktura ${existing.number}.` };

  const supabase = await createClient();
  const advances = docs.filter((d) => d.type === "advance");
  const { data: used } = advances.length
    ? await supabase.from("advance_deductions").select("advance_id").eq("company_id", company.id).in("advance_id", advances.map((a) => a.id))
    : { data: [] as { advance_id: string }[] };
  const usedIds = new Set((used ?? []).map((u) => u.advance_id));

  const warnings: string[] = [];
  const toDeduct: AdvanceToDeduct[] = [];
  const deductions: PreparedDeduction[] = [];
  for (const a of advances) {
    if (usedIds.has(a.id)) continue;
    if (a.status !== "paid") {
      warnings.push(`Záloha ${a.number} ještě není zaplacená, proto se na faktuře neodečte.`);
      continue;
    }
    const rate = (a.snapshot.advanceVatRate ?? 0) as VatRate;
    const paidGross = toHundredths(a.total_due);
    const payerStandard = a.snapshot.vatPayer && a.snapshot.vatMode === "standard";
    const ddpp = docs.find((d) => d.type === "ddpp" && d.related_document_id === a.id);
    if (payerStandard && !ddpp) {
      return { ok: false, draft, error: `K zaplacené záloze ${a.number} chybí daňový doklad k přijaté platbě. Vystavte ho na stránce zálohy.` };
    }
    const row = ddpp?.snapshot.recap[0];
    toDeduct.push({
      advanceNumber: a.number!, ddppNumber: ddpp?.number ?? null, status: "paid", paidGross, vatRate: rate,
      ...(row ? { ddppBase: row.base, ddppVat: row.vat } : {}),
    });
    const base = row ? row.base : paidGross;
    const vat = row ? row.vat : 0;
    deductions.push({ advanceId: a.id, advanceNumber: a.number!, base: toDecimalString(base), vat: toDecimalString(vat), rate: row ? rate : 0 });
  }

  try {
    const snapshot = buildInvoice({
      job: draftToJob(draft, company.minMarginPct),
      title: draft.title,
      supplier: parties.supplier,
      customer: parties.customer,
      vatPayer: parties.vatPayer,
      siteAddress: draft.siteAddress,
      payment: parties.payment,
      deductions: toDeduct,
    });
    if (!parties.payment) warnings.push("Ve firmě není vyplněný bankovní účet, na faktuře nebude QR Platba ani číslo účtu.");
    return { ok: true, snapshot, type: parties.vatPayer ? "invoice" : "invoice_non_payer", draft, deductions, warnings, termsDays: parties.paymentTermsDays };
  } catch (e) {
    return { ok: false, draft, error: message(e, "Fakturu se nepodařilo spočítat.") };
  }
}

export type AdvanceSpec = { kind: "percent" | "amount"; value: string };

export async function prepareAdvance(company: ActiveCompany, jobId: string, spec: AdvanceSpec): Promise<Prepared> {
  const draft = await loadDraft(company.id, jobId);
  const parties = await loadParties(company.id, draft.clientId || null);
  const docs = await jobDocuments(company.id, jobId);
  if (docs.some((d) => (d.type === "invoice" || d.type === "invoice_non_payer") && d.status !== "canceled")) {
    return { ok: false, draft, error: "K zakázce už je vystavená konečná faktura, zálohu už nejde přidat." };
  }
  const value = toHundredths(spec.value);
  try {
    const snapshot = buildAdvance({
      job: draftToJob(draft, company.minMarginPct),
      title: draft.title,
      supplier: parties.supplier,
      customer: parties.customer,
      vatPayer: parties.vatPayer,
      siteAddress: draft.siteAddress,
      payment: parties.payment,
      spec: spec.kind === "percent" ? { percentBp: value } : { amount: value },
    });
    const warnings = parties.payment ? [] : ["Ve firmě není vyplněný bankovní účet, na záloze nebude QR Platba ani číslo účtu."];
    return { ok: true, snapshot, type: "advance", draft, deductions: [], warnings, termsDays: parties.paymentTermsDays };
  } catch (e) {
    return { ok: false, draft, error: message(e, "Zálohu se nepodařilo spočítat.") };
  }
}
