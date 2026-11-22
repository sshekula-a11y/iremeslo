/**
 * Převody mezi databází (numeric jako text, např. "250.00") a výpočty v haléřích (celá čísla).
 * Žádný float: text se rozloží na celou a desetinnou část.
 */

export function toHundredths(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const m = /^(-)?(\d*)(?:\.(\d{0,2})\d*)?$/.exec(s);
  if (!m) return 0;
  const sign = m[1] ? -1 : 1;
  const whole = Number(m[2] || "0");
  const frac = Number((m[3] ?? "").padEnd(2, "0") || "0");
  return sign * (whole * 100 + frac);
}

/** 25000 → "250.00" pro uložení do numeric sloupce. */
export function fromHundredths(n: number): string {
  const neg = n < 0;
  const a = Math.abs(Math.trunc(n));
  return `${neg ? "-" : ""}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}

/** Text z políčka formuláře (čárka i tečka) → setiny; neplatné = 0. */
export const parseInput = toHundredths;

/** Setiny → text do políčka: 25000 → "250", 1250 → "12,5". */
export function toInput(n: number): string {
  if (n === 0) return "";
  const s = fromHundredths(n).replace(/\.?0+$/, "");
  return s.replace(".", ",");
}
