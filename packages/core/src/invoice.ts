import { allocate, lineTotal, mulDivRound, roundToCrowns, type BasisPoints, type Money, type Qty } from "./money.ts";
import { effectiveRate, vatFromBase, vatFromGross, type VatMode, type VatRate, VAT_RATES, VAT_TEXTS } from "./vat.ts";

/**
 * Faktura, zálohová faktura a odečet záloh.
 * Postup u DPH (DDPP, odečet záloh) je podle zadání nutné ověřit s daňovým poradcem.
 */

export interface InvoiceLineInput {
  description: string;
  qty: Qty;
  unit: string;
  /** cena za jednotku bez DPH */
  unitPrice: Money;
  vatRate: VatRate;
}

export type AdvanceStatus = "issued" | "paid" | "settled";

export interface AdvanceToDeduct {
  /** číslo zálohové faktury, např. ZF-2026-012 */
  advanceNumber: string;
  /** číslo daňového dokladu k přijaté platbě (jen plátce), např. DD-2026-007 */
  ddppNumber?: string | null;
  status: AdvanceStatus;
  /** přijatá částka včetně DPH */
  paidGross: Money;
  vatRate: VatRate;
  /** základ a daň přesně tak, jak stojí na vystaveném DDPP; když chybí, dopočítají se */
  ddppBase?: Money;
  ddppVat?: Money;
}

export interface InvoiceInput {
  mode: VatMode;
  lines: InvoiceLineInput[];
  /** sleva na celou fakturu v basis points (10 % = 1000) */
  discountBp?: BasisPoints;
  /** nebo sleva pevnou částkou bez DPH; rozdělí se na sazby v poměru jejich základů */
  discountAmount?: Money;
  deductions?: AdvanceToDeduct[];
  /** zaokrouhlit „celkem k úhradě“ na celé koruny */
  roundTotal?: boolean;
}

export interface RecapRow {
  rate: VatRate;
  base: Money;
  vat: Money;
  total: Money;
}

export interface DeductionRow {
  label: string;
  advanceNumber: string;
  rate: VatRate;
  base: Money;
  vat: Money;
  gross: Money;
}

export interface InvoiceTotals {
  mode: VatMode;
  lines: (InvoiceLineInput & { effectiveRate: VatRate; base: Money })[];
  subtotal: Money;
  discount: Money;
  /** rekapitulace po slevě, před odečtem záloh */
  recap: RecapRow[];
  total: Money;
  deductions: DeductionRow[];
  /** rekapitulace po odečtu záloh (co se skutečně daní touto fakturou) */
  recapAfterDeductions: RecapRow[];
  amountBeforeRounding: Money;
  rounding: Money;
  amountDue: Money;
  /** povinné texty podle režimu */
  notes: string[];
}

export class InvoiceError extends Error {}

function sumByRate(rows: { rate: VatRate; amount: Money }[]): Map<VatRate, Money> {
  const m = new Map<VatRate, Money>();
  for (const r of rows) m.set(r.rate, (m.get(r.rate) ?? 0) + r.amount);
  return m;
}

export function computeInvoice(input: InvoiceInput): InvoiceTotals {
  const { mode } = input;
  const discountBp = input.discountBp ?? 0;
  if (discountBp < 0 || discountBp > 10_000) throw new InvoiceError("sleva musí být 0–100 %");
  if (input.discountAmount !== undefined && input.discountBp) throw new InvoiceError("sleva může být buď v %, nebo částkou");

  const lines = input.lines.map((l) => ({
    ...l,
    effectiveRate: effectiveRate(mode, l.vatRate),
    base: lineTotal(l.qty, l.unitPrice),
  }));
  const subtotal = lines.reduce((s, l) => s + l.base, 0);

  // Sleva se uplatní zvlášť v každé sazbě, aby rekapitulace DPH seděla.
  const baseByRate = sumByRate(lines.map((l) => ({ rate: l.effectiveRate, amount: l.base })));
  const rates = VAT_RATES.filter((r) => (baseByRate.get(r) ?? 0) !== 0);
  let amountShares: Money[] | null = null;
  if (input.discountAmount !== undefined) {
    if (input.discountAmount < 0) throw new InvoiceError("sleva nesmí být záporná");
    if (input.discountAmount > subtotal) throw new InvoiceError("sleva je vyšší než cena");
    amountShares = allocate(input.discountAmount, rates.map((r) => baseByRate.get(r) ?? 0));
  }
  const recap: RecapRow[] = [];
  let discount = 0;
  for (const [i, rate] of rates.entries()) {
    const gross = baseByRate.get(rate) ?? 0;
    const disc = amountShares ? (amountShares[i] ?? 0) : mulDivRound(gross, discountBp, 10_000);
    discount += disc;
    const base = gross - disc;
    const vat = mode === "standard" ? vatFromBase(base, rate) : 0;
    recap.push({ rate, base, vat, total: base + vat });
  }
  const total = recap.reduce((s, r) => s + r.total, 0);

  // Odečet záloh
  const deductions: DeductionRow[] = [];
  const seen = new Set<string>();
  for (const d of input.deductions ?? []) {
    if (seen.has(d.advanceNumber)) throw new InvoiceError(`záloha ${d.advanceNumber} je v seznamu dvakrát`);
    seen.add(d.advanceNumber);
    if (d.status === "issued") throw new InvoiceError(`záloha ${d.advanceNumber} ještě není zaplacená`);
    if (d.status === "settled") throw new InvoiceError(`záloha ${d.advanceNumber} už byla vyúčtována`);
    if (d.paidGross <= 0) throw new InvoiceError(`záloha ${d.advanceNumber} má nulovou částku`);
    const rate = effectiveRate(mode, d.vatRate);
    let base: Money;
    let vat: Money;
    if (mode === "standard") {
      const calc = vatFromGross(d.paidGross, rate);
      base = d.ddppBase ?? calc.base;
      vat = d.ddppVat ?? calc.vat;
      if (base + vat !== d.paidGross) throw new InvoiceError(`DDPP k záloze ${d.advanceNumber} nesedí na přijatou částku`);
    } else {
      base = d.paidGross;
      vat = 0;
    }
    const ref = d.ddppNumber ? ` (DDPP ${d.ddppNumber})` : "";
    deductions.push({
      label: `Odečet zálohy ${d.advanceNumber}${ref}`,
      advanceNumber: d.advanceNumber,
      rate,
      base: -base,
      vat: -vat,
      gross: -(base + vat),
    });
  }

  const recapAfterDeductions: RecapRow[] = recap.map((r) => ({ ...r }));
  for (const d of deductions) {
    const row = recapAfterDeductions.find((r) => r.rate === d.rate);
    if (!row) throw new InvoiceError(`na faktuře není žádná položka v sazbě ${d.rate} %, záloha ${d.advanceNumber} nejde odečíst`);
    row.base += d.base;
    row.vat += d.vat;
    row.total = row.base + row.vat;
    if (row.base < 0 || row.vat < 0) {
      throw new InvoiceError(`odečet zálohy ${d.advanceNumber} je vyšší než částka faktury v sazbě ${d.rate} %`);
    }
  }

  const amountBeforeRounding = recapAfterDeductions.reduce((s, r) => s + r.total, 0);
  const amountDue = input.roundTotal ? roundToCrowns(amountBeforeRounding) : amountBeforeRounding;

  const notes: string[] = [];
  if (mode === "reverse_charge") notes.push(VAT_TEXTS.reverse_charge);
  if (mode === "non_payer") notes.push(VAT_TEXTS.non_payer);

  return {
    mode,
    lines,
    subtotal,
    discount,
    recap,
    total,
    deductions,
    recapAfterDeductions,
    amountBeforeRounding,
    rounding: amountDue - amountBeforeRounding,
    amountDue,
    notes,
  };
}

/** Výše zálohy: % z celkové ceny s DPH, nebo pevná částka. */
export function advanceAmount(totalGross: Money, spec: { percentBp: BasisPoints } | { amount: Money }): Money {
  if ("percentBp" in spec) {
    if (spec.percentBp <= 0 || spec.percentBp > 10_000) throw new InvoiceError("záloha musí být 1–100 %");
    return mulDivRound(totalGross, spec.percentBp, 10_000);
  }
  if (spec.amount <= 0) throw new InvoiceError("záloha musí být kladná");
  if (spec.amount > totalGross) throw new InvoiceError("záloha je vyšší než cena zakázky");
  return spec.amount;
}

/**
 * Daňový doklad k přijaté platbě (DDPP): DPH z přijaté částky.
 * Vystavuje jen plátce, do 15 dnů od přijetí platby (ověřit s daňovým poradcem).
 */
export function ddppFromPayment(received: Money, rate: VatRate): { base: Money; vat: Money; total: Money } {
  if (received <= 0) throw new InvoiceError("přijatá platba musí být kladná");
  const { base, vat } = vatFromGross(received, rate);
  return { base, vat, total: received };
}

/** Poslední den, kdy je třeba vystavit DDPP: 15 dní od přijetí platby. */
export function ddppDeadline(paymentDate: string): string {
  const d = new Date(`${paymentDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new InvoiceError(`neplatné datum ${paymentDate}`);
  d.setUTCDate(d.getUTCDate() + 15);
  return d.toISOString().slice(0, 10);
}
