import { lineTotal, type Money, type Qty } from "./money.ts";
import { summarizeJob, type Job } from "./job.ts";
import { effectiveRate, VAT_TEXTS, type VatMode, type VatRate } from "./vat.ts";
import { advanceAmount, computeInvoice, ddppFromPayment, type AdvanceToDeduct, type DeductionRow, type RecapRow } from "./invoice.ts";

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

// ---------------------------------------------------------------------------
// Faktura, zálohová faktura, daňový doklad k přijaté platbě
// ---------------------------------------------------------------------------

export interface PaymentInfo {
  bankAccount: string | null;
  iban: string | null;
  bic: string | null;
}

export interface InvoiceLine extends DocumentLine {
  vatRate: VatRate;
}

export interface InvoiceSnapshot {
  version: 1;
  kind: "invoice" | "advance" | "ddpp";
  title: string;
  supplier: Party;
  customer: Party;
  siteAddress: string | null;
  vatMode: VatMode;
  vatPayer: boolean;
  lines: InvoiceLine[];
  subtotal: Money;
  discount: Money;
  /** rekapitulace DPH po slevě (u zálohy prázdná – není to daňový doklad) */
  recap: RecapRow[];
  /** celkem včetně DPH před odečtem záloh */
  total: Money;
  deductions: DeductionRow[];
  recapAfterDeductions: RecapRow[];
  rounding: Money;
  /** k úhradě (u DDPP přijatá částka) */
  amountDue: Money;
  notes: string[];
  payment: PaymentInfo | null;
  /** záloha: sazba DPH, ze které se po zaplacení spočítá DDPP */
  advanceVatRate?: VatRate;
  /** DDPP: k jaké zálohové faktuře patří */
  relatedNumber?: string;
}

interface Common {
  title: string;
  supplier: Party;
  customer: Party | null;
  vatPayer: boolean;
  siteAddress?: string | null;
  payment?: PaymentInfo | null;
}

function requireCustomer(c: Party | null): Party {
  if (!c || !c.name.trim()) throw new DocumentError("Faktura musí mít odběratele – vyberte u zakázky klienta.");
  return c;
}

function jobLines(job: Job): InvoiceLine[] {
  const rate = effectiveRate(job.vatMode, job.vatRate);
  return buildQuote({ job, title: "x", supplier: { name: "x" }, customer: null, vatPayer: true }).lines.map((l) => ({ ...l, vatRate: rate }));
}

function modeOf(job: Job, vatPayer: boolean): VatMode {
  return vatPayer ? job.vatMode : "non_payer";
}

/**
 * Konečná faktura ze zakázky. Položky a sleva jsou stejné jako v nabídce a souhrnu zakázky;
 * zaplacené zálohy se odečtou (u plátce podle vystavených DDPP).
 */
export function buildInvoice(input: Common & { job: Job; deductions?: AdvanceToDeduct[] }): InvoiceSnapshot {
  const customer = requireCustomer(input.customer);
  const mode = modeOf(input.job, input.vatPayer);
  if (mode === "reverse_charge" && !customer.dic) {
    throw new DocumentError("U přenesené daňové povinnosti musí mít odběratel DIČ – doplňte ho u klienta.");
  }
  const lines = jobLines(input.job);
  const d = input.job.discount;
  const totals = computeInvoice({
    mode,
    lines,
    ...(d?.kind === "percent" ? { discountBp: d.bp } : d?.kind === "amount" ? { discountAmount: d.amount } : {}),
    deductions: input.deductions ?? [],
  });
  if (totals.total <= 0) throw new DocumentError("Cena faktury musí být kladná.");
  return {
    version: 1,
    kind: "invoice",
    title: input.title.trim(),
    supplier: input.supplier,
    customer,
    siteAddress: input.siteAddress?.trim() || null,
    vatMode: mode,
    vatPayer: input.vatPayer,
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    recap: totals.recap,
    total: totals.total,
    deductions: totals.deductions,
    recapAfterDeductions: totals.recapAfterDeductions,
    rounding: totals.rounding,
    amountDue: totals.amountDue,
    notes: totals.notes,
    payment: input.payment ?? null,
  };
}

/**
 * Zálohová faktura: výzva k platbě, není to daňový doklad. Výše jako % z ceny s DPH nebo částka.
 */
export function buildAdvance(input: Common & { job: Job; spec: { percentBp: number } | { amount: Money } }): InvoiceSnapshot {
  const customer = requireCustomer(input.customer);
  const mode = modeOf(input.job, input.vatPayer);
  const s = summarizeJob(input.job, "plan");
  const gross = mode === "standard" ? s.gross : s.revenue.net;
  if (gross <= 0) throw new DocumentError("Zakázka nemá žádnou cenu, ze které by šla spočítat záloha.");
  const amount = advanceAmount(gross, input.spec);
  const title = input.title.trim();
  const notes: string[] = [VAT_TEXTS.advance];
  if (mode === "non_payer") notes.push(VAT_TEXTS.non_payer);
  return {
    version: 1,
    kind: "advance",
    title,
    supplier: input.supplier,
    customer,
    siteAddress: input.siteAddress?.trim() || null,
    vatMode: mode,
    vatPayer: input.vatPayer,
    lines: [{ description: `Záloha na zakázku: ${title}`, qty: 100, unit: "ks", unitPrice: amount, total: amount, vatRate: 0 }],
    subtotal: amount,
    discount: 0,
    recap: [],
    total: amount,
    deductions: [],
    recapAfterDeductions: [],
    rounding: 0,
    amountDue: amount,
    notes,
    payment: input.payment ?? null,
    advanceVatRate: effectiveRate(mode, input.job.vatRate),
  };
}

/**
 * Daňový doklad k přijaté platbě (jen plátce DPH, režim „standard“): DPH z přijaté zálohy.
 * Vychází ze snapshotu zaplacené zálohové faktury.
 */
export function buildDdpp(advance: InvoiceSnapshot, advanceNumber: string, received: Money): InvoiceSnapshot {
  if (advance.kind !== "advance") throw new DocumentError("DDPP se vystavuje jen k zálohové faktuře.");
  if (!advance.vatPayer || advance.vatMode !== "standard") throw new DocumentError("DDPP vystavuje jen plátce DPH.");
  const rate = advance.advanceVatRate ?? 21;
  const { base, vat, total } = ddppFromPayment(received, rate);
  const row: RecapRow = { rate, base, vat, total };
  return {
    version: 1,
    kind: "ddpp",
    title: advance.title,
    supplier: advance.supplier,
    customer: advance.customer,
    siteAddress: advance.siteAddress,
    vatMode: "standard",
    vatPayer: true,
    lines: [{ description: `Přijatá platba k zálohové faktuře ${advanceNumber}`, qty: 100, unit: "ks", unitPrice: base, total: base, vatRate: rate }],
    subtotal: base,
    discount: 0,
    recap: [row],
    total,
    deductions: [],
    recapAfterDeductions: [row],
    rounding: 0,
    amountDue: total,
    notes: [],
    payment: null,
    relatedNumber: advanceNumber,
  };
}

/** Variabilní symbol z čísla dokladu: jen číslice (FV-2026-001 → 2026001), nejvýš 10. */
export function variableSymbol(documentNumber: string): string {
  const digits = documentNumber.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
