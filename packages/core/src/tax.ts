/**
 * Odhad daně z příjmů a pojistného OSVČ (hlavní činnost) – podklad pro rozhodování, ne daňové přiznání.
 * Parametry jsou ověřené z veřejných zdrojů (zákon o daních z příjmů § 7, § 7a, § 16; ČSSZ; VZP) a mění se
 * každý rok – při novém roce je potřeba doplnit TAX_YEARS.
 */

export interface TaxYearParams {
  year: number;
  /** průměrná mzda pro daně a pojistné */
  avgWage: number;
  /** hranice 23% sazby: 36násobek průměrné mzdy */
  progressiveLimit: number;
  /** sleva na poplatníka (Kč/rok) */
  taxpayerCredit: number;
  /** minimální roční vyměřovací základ – sociální pojištění, hlavní činnost */
  socialMinBase: number;
  /** minimální roční vyměřovací základ – zdravotní pojištění */
  healthMinBase: number;
  /** minimální měsíční zálohy (pro termíny a přehled) */
  socialMinMonthly: number;
  healthMinMonthly: number;
  /** paušální daň – roční částka v pásmu 1, 2, 3 */
  flatTaxYear: [number, number, number];
  /** paušální daň – měsíční platba (aktuální) v pásmu 1, 2, 3 */
  flatTaxMonthly: [number, number, number];
  note?: string;
}

export const TAX_YEARS: Record<number, TaxYearParams> = {
  2025: {
    year: 2025, avgWage: 46_557, progressiveLimit: 1_676_052, taxpayerCredit: 30_840,
    socialMinBase: 12 * 16_295, healthMinBase: 12 * 23_278.5, socialMinMonthly: 4_759, healthMinMonthly: 3_143,
    flatTaxYear: [12 * 8_716, 12 * 16_745, 12 * 27_139], flatTaxMonthly: [8_716, 16_745, 27_139],
  },
  2026: {
    year: 2026, avgWage: 48_967, progressiveLimit: 1_762_812, taxpayerCredit: 30_840,
    // Od 1. 7. 2026 se minimální vyměřovací základ snížil ze 40 % na 35 % průměrné mzdy se zpětnou platností od ledna
    // (přeplatek za leden–červen vrací ČSSZ na žádost). Paušální daň v 1. pásmu: 9 984 Kč do června, 9 162 Kč od července.
    socialMinBase: 12 * 17_139, healthMinBase: 12 * 24_483.5, socialMinMonthly: 5_005, healthMinMonthly: 3_306,
    flatTaxYear: [6 * 9_984 + 6 * 9_162, 12 * 16_745, 12 * 27_139], flatTaxMonthly: [9_162, 16_745, 27_139],
    note: "Minimální záloha na sociální pojištění klesla od července 2026 z 5 720 Kč na 5 005 Kč se zpětnou platností od ledna – o přeplatek za leden až červen je potřeba požádat ČSSZ do konce roku 2026.",
  },
  2027: {
    year: 2027, avgWage: 51_663, progressiveLimit: 36 * 51_663, taxpayerCredit: 30_840,
    socialMinBase: 12 * 18_083, healthMinBase: 12 * 25_831.5, socialMinMonthly: 5_281, healthMinMonthly: 3_488,
    flatTaxYear: [12 * 9_662, 12 * 16_745, 12 * 27_139], flatTaxMonthly: [9_662, 16_745, 27_139],
  },
};

export const taxParams = (year: number): TaxYearParams | null => TAX_YEARS[year] ?? null;

/** Výdajové paušály: 80 % řemeslné živnosti, 60 % ostatní živnosti, 40 % svobodná povolání. Limit výdajů. */
export const FLAT_EXPENSE_CAP: Record<FlatRate, number> = { 80: 1_600_000, 60: 1_200_000, 40: 800_000 };
export type FlatRate = 80 | 60 | 40;

/** DPH: povinná registrace po překročení obratu 2 mil. Kč za kalendářní rok; nad 2 536 500 Kč plátcem hned. */
export const VAT_THRESHOLD = 2_000_000;
export const VAT_IMMEDIATE = 2_536_500;
export const FLAT_TAX_INCOME_LIMIT = 2_000_000;

const SOCIAL_RATE = 0.292;
const HEALTH_RATE = 0.135;

export interface RegimeResult {
  regime: "actual" | "flat_expenses" | "flat_tax";
  /** uplatněné výdaje (u paušální daně 0) */
  expenses: number;
  profit: number;
  taxBase: number;
  tax: number;
  social: number;
  health: number;
  total: number;
  /** pásmo paušální daně (jen u flat_tax) */
  band?: 1 | 2 | 3;
}

/** Daň z příjmů FO: základ zaokrouhlený na stovky dolů, 15 % do hranice, 23 % nad ní, minus sleva na poplatníka. */
export function incomeTax(profit: number, p: TaxYearParams): { base: number; tax: number } {
  const base = Math.max(0, Math.floor(profit / 100) * 100);
  const gross = Math.ceil(Math.min(base, p.progressiveLimit) * 0.15 + Math.max(0, base - p.progressiveLimit) * 0.23);
  return { base, tax: Math.max(0, gross - p.taxpayerCredit) };
}

/** Pojistné OSVČ (hlavní činnost, celý rok): vyměřovací základ 50 % zisku, nejméně zákonné minimum. */
export function insurance(profit: number, p: TaxYearParams): { social: number; health: number } {
  const half = Math.max(0, profit) * 0.5;
  return {
    social: Math.ceil(Math.ceil(Math.max(half, p.socialMinBase)) * SOCIAL_RATE),
    health: Math.ceil(Math.ceil(Math.max(half, p.healthMinBase)) * HEALTH_RATE),
  };
}

/** Pásmo paušální daně podle příjmů a výdajového paušálu převažující činnosti; null = nelze. */
export function flatTaxBand(income: number, flatRate: FlatRate, vatPayer: boolean): 1 | 2 | 3 | null {
  if (vatPayer || income > FLAT_TAX_INCOME_LIMIT) return null;
  if (income <= 1_000_000) return 1;
  if (flatRate === 80) return 1; // ≥ 75 % příjmů s 80% paušálem: 1. pásmo až do 2 mil. Kč
  if (flatRate === 60) return income <= 1_500_000 ? 1 : 2;
  return income <= 1_500_000 ? 2 : 3;
}

function regime(kind: "actual" | "flat_expenses", income: number, expenses: number, p: TaxYearParams): RegimeResult {
  const profit = Math.max(0, income - expenses);
  const { base, tax } = incomeTax(profit, p);
  const { social, health } = insurance(profit, p);
  return { regime: kind, expenses, profit, taxBase: base, tax, social, health, total: tax + social + health };
}

/** Porovná skutečné výdaje, výdajový paušál a paušální daň pro OSVČ s hlavní činností. */
export function compareRegimes(input: { year: number; income: number; actualExpenses: number; flatRate: FlatRate; vatPayer: boolean }): RegimeResult[] | null {
  const p = taxParams(input.year);
  if (!p) return null;
  const income = Math.max(0, input.income);
  const out: RegimeResult[] = [
    regime("actual", income, Math.max(0, input.actualExpenses), p),
    regime("flat_expenses", income, Math.min(income * (input.flatRate / 100), FLAT_EXPENSE_CAP[input.flatRate]), p),
  ];
  const band = flatTaxBand(income, input.flatRate, input.vatPayer);
  if (band) {
    const total = p.flatTaxYear[band - 1];
    out.push({ regime: "flat_tax", expenses: 0, profit: 0, taxBase: 0, tax: total, social: 0, health: 0, total, band });
  }
  return out;
}

/** Odhad za celý rok z dosavadních čísel (lineárně podle uplynulé části roku). */
export function annualize(value: number, year: number, today: string): number {
  const y = Number(today.slice(0, 4));
  if (y > year) return value;
  if (y < year) return 0;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const now = Date.UTC(year, Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) + 1);
  const part = Math.min(1, Math.max(1 / 365, (now - start) / (end - start)));
  return Math.round(value / part);
}
