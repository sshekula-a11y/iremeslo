import { lineTotal, mulDivRound, type BasisPoints, type Money, type Qty } from "./money.ts";
import { effectiveRate, vatFromBase, type VatMode, type VatRate } from "./vat.ts";

/** Výchozí číselník jednotek ze zadání; firma si může přidat vlastní. */
export const DEFAULT_UNITS = ["m²", "m³", "bm", "ks", "l", "kg", "m", "hod", "den", "bal.", "paušál"] as const;
export type Unit = string;

export interface WorkItem {
  description: string;
  qty: Qty;
  unit: Unit;
  /** cena za jednotku bez DPH */
  unitPrice: Money;
}

export interface MaterialItem {
  description: string;
  qtyPlanned: Qty;
  /** skutečně spotřebované množství; null = zatím nezapsáno */
  qtyActual?: Qty | null;
  unit: Unit;
  /** nákupní cena za jednotku – vstupuje do nákladů */
  purchasePrice: Money;
  /** prodejní cena za jednotku – účtuje se zákazníkovi, pokud billable */
  salePrice: Money;
  /** false = materiál je zahrnutý v ceně práce, je to jen náklad */
  billable: boolean;
}

export interface LaborItem {
  name: string;
  employeeId?: string;
  qtyPlanned: Qty;
  qtyActual?: Qty | null;
  unit: "hod" | "den";
  /** nákladová sazba za hodinu nebo den */
  rate: Money;
}

export interface ExpenseItem {
  description: string;
  qtyPlanned: Qty;
  qtyActual?: Qty | null;
  unitPrice: Money;
}

export type Discount =
  | { kind: "percent"; bp: BasisPoints }
  | { kind: "amount"; amount: Money };

export interface Job {
  work: WorkItem[];
  materials: MaterialItem[];
  labor: LaborItem[];
  expenses: ExpenseItem[];
  discount?: Discount | null;
  vatMode: VatMode;
  vatRate: VatRate;
  /** hranice marže pro varování, výchozí 15 % */
  minMarginBp?: BasisPoints;
}

export type Scenario = "plan" | "actual";

export interface JobSummary {
  scenario: Scenario;
  costs: { materials: Money; labor: Money; expenses: Money; total: Money };
  revenue: { work: Money; materials: Money; subtotal: Money; discount: Money; net: Money };
  /** výdělek = cena bez DPH − náklady */
  profit: Money;
  /** marže v basis points (3918 = 39,18 %); null, když je cena nulová */
  marginBp: BasisPoints | null;
  lowMargin: boolean;
  vatRate: VatRate;
  vat: Money;
  gross: Money;
  /** u scénáře „actual“: kolik řádků ještě nemá zapsanou skutečnost (počítá se plánem) */
  missingActuals: number;
}

export const DEFAULT_MIN_MARGIN_BP: BasisPoints = 1500;

/** Prodejní cena materiálu předvyplněná z nákupní ceny a přirážky firmy. */
export function salePriceFromMarkup(purchasePrice: Money, markupBp: BasisPoints): Money {
  return purchasePrice + mulDivRound(purchasePrice, markupBp, 10_000);
}

function pickQty(planned: Qty, actual: Qty | null | undefined, scenario: Scenario): { qty: Qty; missing: boolean } {
  if (scenario === "plan") return { qty: planned, missing: false };
  if (actual === null || actual === undefined) return { qty: planned, missing: true };
  return { qty: actual, missing: false };
}

export function discountAmount(subtotal: Money, discount: Discount | null | undefined): Money {
  if (!discount) return 0;
  if (discount.kind === "percent") {
    if (discount.bp < 0 || discount.bp > 10_000) throw new RangeError("sleva musí být 0–100 %");
    return mulDivRound(subtotal, discount.bp, 10_000);
  }
  if (discount.amount < 0) throw new RangeError("sleva nesmí být záporná");
  if (discount.amount > subtotal) throw new RangeError("sleva je vyšší než cena zakázky");
  return discount.amount;
}

/** Souhrn zakázky podle vzorců ze zadání (všechno bez DPH, DPH až na konci). */
export function summarizeJob(job: Job, scenario: Scenario = "plan"): JobSummary {
  let missing = 0;

  const work = job.work.reduce((s, w) => s + lineTotal(w.qty, w.unitPrice), 0);

  let materialCost = 0;
  let materialSale = 0;
  for (const m of job.materials) {
    const { qty, missing: miss } = pickQty(m.qtyPlanned, m.qtyActual, scenario);
    if (miss) missing++;
    materialCost += lineTotal(qty, m.purchasePrice);
    if (m.billable) materialSale += lineTotal(qty, m.salePrice);
  }

  let labor = 0;
  for (const l of job.labor) {
    const { qty, missing: miss } = pickQty(l.qtyPlanned, l.qtyActual, scenario);
    if (miss) missing++;
    labor += lineTotal(qty, l.rate);
  }

  let expenses = 0;
  for (const e of job.expenses) {
    const { qty, missing: miss } = pickQty(e.qtyPlanned, e.qtyActual, scenario);
    if (miss) missing++;
    expenses += lineTotal(qty, e.unitPrice);
  }

  const subtotal = work + materialSale;
  const discount = discountAmount(subtotal, job.discount);
  const net = subtotal - discount;
  const costsTotal = materialCost + labor + expenses;
  const profit = net - costsTotal;
  const marginBp = net === 0 ? null : mulDivRound(profit, 10_000, net);
  const rate = effectiveRate(job.vatMode, job.vatRate);
  const vat = job.vatMode === "standard" ? vatFromBase(net, rate) : 0;
  const minMargin = job.minMarginBp ?? DEFAULT_MIN_MARGIN_BP;

  return {
    scenario,
    costs: { materials: materialCost, labor, expenses, total: costsTotal },
    revenue: { work, materials: materialSale, subtotal, discount, net },
    profit,
    marginBp,
    lowMargin: marginBp !== null && marginBp < minMargin,
    vatRate: rate,
    vat,
    gross: net + vat,
    missingActuals: scenario === "actual" ? missing : 0,
  };
}

/** Plán vs. skutečnost vedle sebe a rozdíl (skutečnost − plán). */
export function planVsActual(job: Job) {
  const plan = summarizeJob(job, "plan");
  const actual = summarizeJob(job, "actual");
  return {
    plan,
    actual,
    diff: {
      costs: actual.costs.total - plan.costs.total,
      materials: actual.costs.materials - plan.costs.materials,
      labor: actual.costs.labor - plan.costs.labor,
      expenses: actual.costs.expenses - plan.costs.expenses,
      net: actual.revenue.net - plan.revenue.net,
      profit: actual.profit - plan.profit,
    },
  };
}
