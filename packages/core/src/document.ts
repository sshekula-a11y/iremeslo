import { lineTotal, type Money, type Qty } from "./money.ts";
import { summarizeJob, type Job } from "./job.ts";
import { VAT_TEXTS, type VatMode, type VatRate } from "./vat.ts";

/**
 * Obsah dokladu tak, jak se v okamžiku vystavení uloží do documents.snapshot.
 * Z něj se kreslí náhled i PDF; pozdější změny firmy, klienta nebo zakázky už vystavený doklad nezmění.
 * Peníze jsou v haléřích, množství v setinách jednotky (celá čísla).
 */

export interface Party {
  name: string;
  ico?: string | null;
  dic?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  email?: string | null;
  phone?: string | null;
  web?: string | null;
  /** zápis v obchodním / živnostenském rejstříku */
  registerEntry?: string | null;
}

export interface DocumentLine {
  description: string;
  qty: Qty;
  unit: string;
  /** bez DPH */
  unitPrice: Money;
  /** bez DPH */
  total: Money;
}

export interface QuoteSnapshot {
  version: 1;
  kind: "quote";
  title: string;
  supplier: Party;
  customer: Party | null;
  siteAddress: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  vatMode: VatMode;
  vatPayer: boolean;
  lines: DocumentLine[];
  totals: {
    subtotal: Money;
    discount: Money;
    net: Money;
    vatRate: VatRate;
    vat: Money;
    gross: Money;
  };
  /** povinné texty podle režimu DPH */
  notes: string[];
  /** poznámka pro zákazníka */
  note: string | null;
}

export interface QuoteInput {
  job: Job;
  title: string;
  supplier: Party;
  customer: Party | null;
  vatPayer: boolean;
  siteAddress?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  note?: string | null;
}

export class DocumentError extends Error {}

/**
 * Cenová nabídka ze zakázky: zákazník vidí jen práce a účtovaný materiál, ne náklady, lidi ani výdaje.
 * Součty se berou ze stejného výpočtu jako souhrn zakázky, takže nabídka vždy sedí se zakázkou.
 */
export function buildQuote(input: QuoteInput): QuoteSnapshot {
  const { job } = input;
  const lines: DocumentLine[] = [];
  for (const w of job.work) {
    const total = lineTotal(w.qty, w.unitPrice);
    if (!w.description.trim() && total === 0) continue;
    lines.push({ description: w.description.trim(), qty: w.qty, unit: w.unit, unitPrice: w.unitPrice, total });
  }
  for (const m of job.materials) {
    if (!m.billable) continue;
    const total = lineTotal(m.qtyPlanned, m.salePrice);
    if (!m.description.trim() && total === 0) continue;
    lines.push({ description: m.description.trim(), qty: m.qtyPlanned, unit: m.unit, unitPrice: m.salePrice, total });
  }
  if (lines.length === 0) throw new DocumentError("Nabídka nemá žádnou položku – doplňte práce nebo materiál.");
  if (lines.some((l) => !l.description)) throw new DocumentError("Každá položka nabídky musí mít popis.");

  const s = summarizeJob(job, "plan");
  if (s.revenue.net <= 0) throw new DocumentError("Cena nabídky musí být kladná.");

  const notes: string[] = [];
  if (job.vatMode === "reverse_charge") notes.push(VAT_TEXTS.reverse_charge);
  if (job.vatMode === "non_payer" || !input.vatPayer) notes.push(VAT_TEXTS.non_payer);

  return {
    version: 1,
    kind: "quote",
    title: input.title.trim(),
    supplier: input.supplier,
    customer: input.customer,
    siteAddress: input.siteAddress?.trim() || null,
    dateFrom: input.dateFrom || null,
    dateTo: input.dateTo || null,
    vatMode: input.vatPayer ? job.vatMode : "non_payer",
    vatPayer: input.vatPayer,
    lines,
    totals: {
      subtotal: s.revenue.subtotal,
      discount: s.revenue.discount,
      net: s.revenue.net,
      vatRate: input.vatPayer ? s.vatRate : 0,
      vat: input.vatPayer ? s.vat : 0,
      gross: input.vatPayer ? s.gross : s.revenue.net,
    },
    notes: [...new Set(notes)],
    note: input.note?.trim() || null,
  };
}
