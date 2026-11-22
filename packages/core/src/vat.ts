import { mulDivRound, type Money } from "./money.ts";

/**
 * Režim DPH dokladu nebo zakázky.
 * - standard: plátce, sazby 21 / 12 / 0 %
 * - reverse_charge: přenesená daňová povinnost (§ 92e, stavební práce pro plátce) – 0 %, text „Daň odvede zákazník“
 * - non_payer: dodavatel není plátce, DPH se nepočítá, text „Nejsem plátce DPH“
 *
 * Postup ověřit s daňovým poradcem (zadání to výslovně požaduje).
 */
export type VatMode = "standard" | "reverse_charge" | "non_payer";
export type VatRate = 0 | 12 | 21;
export const VAT_RATES: readonly VatRate[] = [21, 12, 0];

export const VAT_TEXTS = {
  reverse_charge: "Daň odvede zákazník",
  non_payer: "Nejsem plátce DPH",
  advance: "Nejedná se o daňový doklad",
} as const;

export function isVatRate(n: number): n is VatRate {
  return n === 0 || n === 12 || n === 21;
}

/** Sazba, která se na doklad skutečně použije podle režimu. */
export function effectiveRate(mode: VatMode, rate: VatRate): VatRate {
  return mode === "standard" ? rate : 0;
}

/** DPH ze základu (shora dolů): základ × sazba. */
export function vatFromBase(base: Money, rate: VatRate): Money {
  return mulDivRound(base, rate, 100);
}

/**
 * DPH z částky včetně daně (zdola nahoru), např. u přijaté zálohy (DDPP):
 * daň = částka × sazba / (100 + sazba), zaokrouhleno na haléře; základ = částka − daň.
 */
export function vatFromGross(gross: Money, rate: VatRate): { base: Money; vat: Money } {
  const vat = mulDivRound(gross, rate, 100 + rate);
  return { base: gross - vat, vat };
}

export interface VatRecapLine {
  rate: VatRate;
  base: Money;
  vat: Money;
  total: Money;
}

/**
 * Rekapitulace DPH podle sazeb: základy se sečtou po sazbách a daň se spočítá z každého součtu.
 * Řádky se vrací v pořadí 21, 12, 0 % a jen ty, které mají nenulový základ.
 */
export function vatRecap(items: { base: Money; rate: VatRate }[], mode: VatMode): VatRecapLine[] {
  const byRate = new Map<VatRate, Money>();
  for (const it of items) {
    const r = effectiveRate(mode, it.rate);
    byRate.set(r, (byRate.get(r) ?? 0) + it.base);
  }
  const out: VatRecapLine[] = [];
  for (const rate of VAT_RATES) {
    const base = byRate.get(rate);
    if (base === undefined || base === 0) continue;
    const vat = mode === "standard" ? vatFromBase(base, rate) : 0;
    out.push({ rate, base, vat, total: base + vat });
  }
  return out;
}
