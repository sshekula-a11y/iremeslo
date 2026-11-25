import "server-only";
import { lineTotal, type InvoiceSnapshot, type VatMode, type VatRate } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";
import { toHundredths } from "@/lib/money";
import type { ActiveCompany } from "@/lib/data";
import { loadDraft } from "@/app/app/zakazky/load";
import { draftToJob } from "@/app/app/zakazky/summary";
import { loadParties } from "./parties";
import type { ContractSnapshot } from "./contract";
import type { DeliveryLine, ListinaContext, ListinaType } from "./extra";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Podklady pro novou listinu ze systému (zakázka, faktura, smlouva). Server je načte stejně
 * pro formulář i pro uložení – údaje z prohlížeče se na částky a strany nepoužijí.
 */
export async function loadListinaContext(company: ActiveCompany, type: ListinaType, ids: { jobId?: string | null; docId?: string | null })
  : Promise<ListinaContext | { error: string }> {
  const supabase = await createClient();
  const jobId = ids.jobId && UUID.test(ids.jobId) ? ids.jobId : null;
  const docId = ids.docId && UUID.test(ids.docId) ? ids.docId : null;
  let clientId: string | null = null;
  let vatMode: VatMode = "standard";
  let vatRate: VatRate = 21;
  let job: ListinaContext["job"];
  let invoice: ListinaContext["invoice"];
  let contract: ListinaContext["contract"];
  let related: ListinaContext["related"];
  let relatedId: string | null = null;
  let jobRef: string | null = jobId;

  if (jobId) {
    const draft = await loadDraft(company.id, jobId);
    clientId = draft.clientId || null;
    vatMode = draft.vatMode;
    vatRate = draft.vatRate as VatRate;
    const j = draftToJob(draft, company.minMarginPct);
    const lines: DeliveryLine[] = [
      ...j.work.filter((w) => w.description.trim()).map((w) => ({ description: w.description.trim(), qty: w.qty, unit: w.unit, unitPrice: w.unitPrice, total: lineTotal(w.qty, w.unitPrice) })),
      ...j.materials.filter((m) => m.billable && m.description.trim()).map((m) => ({ description: m.description.trim(), qty: m.qtyPlanned, unit: m.unit, unitPrice: m.salePrice, total: lineTotal(m.qtyPlanned, m.salePrice) })),
    ];
    job = { number: draft.number ?? "", title: draft.title, siteAddress: draft.siteAddress || null, lines };
    related = { label: `Zakázka ${draft.number ?? ""} – ${draft.title}`.trim() };
  }

  if (docId) {
    const { data: d } = await supabase.from("documents")
      .select("id, type, number, status, issue_date, due_date, total_due, client_id, job_id, vat_mode, snapshot, payments(amount)")
      .eq("company_id", company.id).eq("id", docId).not("number", "is", null).maybeSingle();
    if (!d) return { error: "Doklad nenalezen." };
    clientId = d.client_id;
    jobRef = jobRef ?? d.job_id;
    relatedId = d.id;
    vatMode = d.vat_mode as VatMode;
    if (["invoice", "invoice_non_payer", "advance"].includes(d.type)) {
      const paid = ((d as unknown as { payments: { amount: string }[] }).payments ?? []).reduce((a, p) => a + toHundredths(p.amount), 0);
      const total = toHundredths(String(d.total_due));
      invoice = { number: d.number!, issueDate: d.issue_date, dueDate: d.due_date, total, paid: d.status === "paid" ? total : paid, amountDue: d.status === "paid" ? 0 : Math.max(0, total - paid) };
      related = { label: `Faktura ${d.number}` };
    } else if (d.type === "contract") {
      const s = d.snapshot as ContractSnapshot;
      vatRate = s.vatRate;
      const { count } = await supabase.from("documents").select("id", { count: "exact", head: true })
        .eq("company_id", company.id).eq("type", "amendment").eq("related_document_id", d.id).not("number", "is", null);
      contract = { number: d.number!, title: s.title, nextNo: (count ?? 0) + 1 };
      related = { label: `Smlouva o dílo ${d.number}` };
    } else {
      related = { label: `${d.number}` };
    }
    if (type === "reminder" && !invoice) return { error: "Upomínka se vystavuje k faktuře." };
    if (type === "amendment" && !contract) return { error: "Dodatek se vystavuje ke smlouvě o dílo." };
    if (invoice && (d.snapshot as InvoiceSnapshot)?.customer && !clientId) clientId = null;
  }
  if (type === "delivery" && !job) return { error: "Dodací list se vystavuje ze zakázky." };

  const parties = await loadParties(company.id, clientId);
  return {
    type, supplier: parties.supplier, customer: parties.customer, clientId, jobId: jobRef, relatedId,
    vatPayer: parties.vatPayer, vatMode, vatRate, payment: parties.payment, job, invoice, contract, related,
  };
}
