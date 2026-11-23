"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildDdpp, buildQuote, DocumentError, toDecimalString, type InvoiceSnapshot } from "@iremeslo/core";
import { requireStaff, type ActiveCompany } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { toHundredths } from "@/lib/money";
import { addDays, todayInPrague } from "@/lib/calendar";
import { loadDraft } from "@/app/app/zakazky/load";
import { draftToJob } from "@/app/app/zakazky/summary";
import { loadParties } from "@/lib/documents/parties";
import { prepareAdvance, prepareInvoice, type AdvanceSpec, type Prepared } from "@/lib/documents/prepare";

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function currentUser() {
  const supabase = await createClient();
  return (await supabase.auth.getClaims()).data?.claims?.sub ?? null;
}

/**
 * Založí koncept a hned ho vystaví funkcí issue_document (číslo z řady, data, zámek).
 * Když vystavení selže, koncept se smaže, ať v seznamu nestraší.
 */
async function insertAndIssue(
  company: ActiveCompany,
  row: Record<string, unknown>,
  afterInsert?: (id: string) => Promise<string | null>,
): Promise<CreateResult> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({ company_id: company.id, created_by: await currentUser(), ...row })
    .select("id")
    .single();
  if (error || !doc) return { ok: false, error: "Doklad se nepodařilo uložit." };

  const fail = async (text: string): Promise<CreateResult> => {
    await supabase.from("documents").delete().eq("company_id", company.id).eq("id", doc.id);
    return { ok: false, error: text };
  };
  if (afterInsert) {
    const err = await afterInsert(doc.id);
    if (err) return fail(err);
  }
  const { error: issueError } = await supabase.rpc("issue_document", { p_document: doc.id, p_issue_date: todayInPrague() });
  if (issueError) {
    if (issueError.message.includes("potvrďte svůj e-mail")) {
      return fail("Fakturu vystavíte po potvrzení e-mailu. Klikněte na odkaz, který jsme vám poslali (nahoře můžete poslat nový).");
    }
    return fail("Doklad se nepodařilo vystavit: " + issueError.message);
  }
  return { ok: true, id: doc.id };
}

// ---------------------------------------------------------------------------
// Cenová nabídka
// ---------------------------------------------------------------------------

/**
 * Vystaví cenovou nabídku z uložené zakázky: obsah se zamrazí do snapshotu, doklad dostane číslo
 * z řady CN a od té chvíle ho nejde změnit. Novou cenu = nová nabídka.
 */
export async function createQuote(jobId: string): Promise<CreateResult> {
  const company = await requireStaff();
  if (!uuid.safeParse(jobId).success) return { ok: false, error: "Neplatná zakázka" };
  const draft = await loadDraft(company.id, jobId);
  const parties = await loadParties(company.id, draft.clientId || null);

  let snapshot;
  try {
    snapshot = buildQuote({
      job: draftToJob(draft, company.minMarginPct),
      title: draft.title,
      supplier: parties.supplier,
      customer: parties.customer,
      vatPayer: parties.vatPayer,
      siteAddress: draft.siteAddress,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
    });
  } catch (e) {
    return { ok: false, error: e instanceof DocumentError || e instanceof RangeError ? e.message : "Nabídku se nepodařilo spočítat." };
  }

  const res = await insertAndIssue(company, {
    job_id: jobId,
    client_id: draft.clientId || null,
    type: "quote",
    vat_mode: snapshot.vatMode,
    total_due: toDecimalString(snapshot.totals.gross),
    snapshot,
  });
  if (res.ok) revalidatePath(`/app/zakazky/${jobId}`);
  return res;
}

// ---------------------------------------------------------------------------
// Faktura a zálohová faktura
// ---------------------------------------------------------------------------

function draftRow(jobId: string, p: Extract<Prepared, { ok: true }>, extra: Record<string, unknown> = {}) {
  return {
    job_id: jobId,
    client_id: p.draft.clientId,
    type: p.type,
    vat_mode: p.snapshot.vatMode,
    total_due: toDecimalString(p.snapshot.amountDue),
    snapshot: p.snapshot,
    ...extra,
  };
}

/** Konečná faktura ze zakázky; zaplacené zálohy se odečtou. DUZP volí uživatel v náhledu. */
export async function createInvoice(jobId: string, taxableDate: string): Promise<CreateResult> {
  const company = await requireStaff();
  if (!uuid.safeParse(jobId).success) return { ok: false, error: "Neplatná zakázka" };
  if (!isoDate.safeParse(taxableDate).success) return { ok: false, error: "Vyplňte datum zdanitelného plnění." };
  const today = todayInPrague();
  if (taxableDate < addDays(today, -366) || taxableDate > addDays(today, 31)) {
    return { ok: false, error: "Datum zdanitelného plnění může být nejvýše rok zpětně a měsíc dopředu." };
  }

  const p = await prepareInvoice(company, jobId);
  if (!p.ok) return { ok: false, error: p.error };

  const supabase = await createClient();
  const res = await insertAndIssue(company, draftRow(jobId, p, { taxable_date: taxableDate }), async (invoiceId) => {
    if (!p.deductions.length) return null;
    const { error } = await supabase.from("advance_deductions").insert(
      p.deductions.map((d) => ({ company_id: company.id, invoice_id: invoiceId, advance_id: d.advanceId, base: d.base, vat: d.vat, vat_rate: d.rate })),
    );
    return error ? "Zálohy se nepodařilo odečíst: " + error.message : null;
  });
  if (!res.ok) return res;

  // Faktura uhrazená celá zálohami je rovnou zaplacená.
  if (p.snapshot.amountDue === 0) await supabase.from("documents").update({ status: "paid" }).eq("company_id", company.id).eq("id", res.id);
  await supabase.from("jobs").update({ status: p.snapshot.amountDue === 0 ? "paid" : "invoiced" }).eq("company_id", company.id).eq("id", jobId);
  revalidateMoney(jobId);
  return res;
}

export async function createAdvance(jobId: string, spec: AdvanceSpec): Promise<CreateResult> {
  const company = await requireStaff();
  if (!uuid.safeParse(jobId).success) return { ok: false, error: "Neplatná zakázka" };
  if (!z.object({ kind: z.enum(["percent", "amount"]), value: z.string().max(20) }).safeParse(spec).success) {
    return { ok: false, error: "Zadejte výši zálohy." };
  }
  const p = await prepareAdvance(company, jobId, spec);
  if (!p.ok) return { ok: false, error: p.error };
  const res = await insertAndIssue(company, draftRow(jobId, p));
  if (res.ok) revalidateMoney(jobId);
  return res;
}

// ---------------------------------------------------------------------------
// Platby
// ---------------------------------------------------------------------------

const METHODS = ["bank", "cash", "card", "other"] as const;

/**
 * Označí fakturu nebo zálohu jako zaplacenou (celou částkou). U zálohy plátce DPH se hned
 * vystaví daňový doklad k přijaté platbě (DDPP) s datem přijetí platby.
 */
export async function markPaid(documentId: string, paidOn: string, method: string): Promise<CreateResult> {
  const company = await requireStaff();
  if (!uuid.safeParse(documentId).success) return { ok: false, error: "Neplatný doklad" };
  if (!isoDate.safeParse(paidOn).success) return { ok: false, error: "Vyplňte datum platby." };
  if (paidOn > todayInPrague()) return { ok: false, error: "Datum platby nemůže být v budoucnosti." };
  if (!(METHODS as readonly string[]).includes(method)) return { ok: false, error: "Neplatný způsob platby." };

  const supabase = await createClient();
  const { data: d } = await supabase
    .from("documents")
    .select("id, type, number, status, total_due, job_id, client_id, issue_date, snapshot")
    .eq("company_id", company.id)
    .eq("id", documentId)
    .single();
  if (!d || !["invoice", "invoice_non_payer", "advance"].includes(d.type)) return { ok: false, error: "Tento doklad se neplatí." };
  if (d.status === "paid") return { ok: false, error: "Doklad už je zaplacený." };
  if (d.status !== "issued" && d.status !== "sent") return { ok: false, error: "Doklad není vystavený." };
  if (d.issue_date && paidOn < addDays(d.issue_date, -60)) return { ok: false, error: "Datum platby je příliš dlouho před vystavením dokladu." };

  const { error: payErr } = await supabase.from("payments").insert({
    company_id: company.id, document_id: d.id, paid_on: paidOn, amount: String(d.total_due), method, created_by: await currentUser(),
  });
  if (payErr) return { ok: false, error: "Platbu se nepodařilo uložit." };
  const { error: stErr } = await supabase.from("documents").update({ status: "paid" }).eq("company_id", company.id).eq("id", d.id);
  if (stErr) return { ok: false, error: "Stav dokladu se nepodařilo změnit." };

  if (d.type !== "advance" && d.job_id) {
    await supabase.from("jobs").update({ status: "paid" }).eq("company_id", company.id).eq("id", d.job_id);
  }
  const snap = d.snapshot as InvoiceSnapshot;
  if (d.type === "advance" && snap.vatPayer && snap.vatMode === "standard") {
    const dd = await issueDdppFor(company, { ...d, total_due: String(d.total_due) }, paidOn);
    if (!dd.ok) {
      revalidateMoney(d.job_id);
      return { ok: false, error: `Platba je uložená, ale daňový doklad k platbě se nevystavil: ${dd.error} Zkuste to tlačítkem na stránce zálohy.` };
    }
  }
  revalidateMoney(d.job_id);
  return { ok: true, id: d.id };
}

/** Ruční vystavení DDPP k zaplacené záloze (když se při zaplacení nepovedlo). */
export async function issueDdpp(advanceId: string): Promise<CreateResult> {
  const company = await requireStaff();
  if (!uuid.safeParse(advanceId).success) return { ok: false, error: "Neplatný doklad" };
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("documents")
    .select("id, type, number, status, total_due, job_id, client_id, snapshot, payments(paid_on)")
    .eq("company_id", company.id)
    .eq("id", advanceId)
    .single();
  if (!d || d.type !== "advance" || d.status !== "paid") return { ok: false, error: "Daňový doklad k přijaté platbě lze vystavit jen k zaplacené záloze." };
  const paidOn = ((d as unknown as { payments: { paid_on: string }[] }).payments ?? []).map((p) => p.paid_on).sort().at(-1) ?? todayInPrague();
  const res = await issueDdppFor(company, { ...d, total_due: String(d.total_due) }, paidOn);
  revalidateMoney(d.job_id);
  return res;
}

async function issueDdppFor(
  company: ActiveCompany,
  adv: { id: string; number: string | null; total_due: string; job_id: string | null; client_id: string | null; snapshot: unknown },
  paidOn: string,
): Promise<CreateResult> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("documents").select("id").eq("company_id", company.id).eq("related_document_id", adv.id).not("number", "is", null).maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  let snapshot;
  try {
    snapshot = buildDdpp(adv.snapshot as InvoiceSnapshot, adv.number ?? "", toHundredths(adv.total_due));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Daňový doklad k přijaté platbě se nepodařilo spočítat." };
  }
  return insertAndIssue(company, {
    job_id: adv.job_id,
    client_id: adv.client_id,
    type: "ddpp",
    vat_mode: "standard",
    taxable_date: paidOn,
    total_due: toDecimalString(snapshot.amountDue),
    related_document_id: adv.id,
    snapshot,
  });
}

function revalidateMoney(jobId: string | null) {
  revalidatePath("/app/faktury");
  revalidatePath("/app");
  if (jobId) revalidatePath(`/app/zakazky/${jobId}`);
}
