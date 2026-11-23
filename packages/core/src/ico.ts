/**
 * Kontrola IČO (8 číslic, kontrolní číslice modulo 11) a DIČ.
 * Kontrola proběhne ještě před dotazem do ARES, aby se zbytečně nevolal s překlepem.
 */

export function normalizeIco(input: string): string {
  const digits = input.replace(/\s/g, "");
  if (!/^\d{1,8}$/.test(digits)) throw new RangeError("IČO může mít nejvýše 8 číslic");
  return digits.padStart(8, "0");
}

export function isValidIco(input: string): boolean {
  let ico: string;
  try {
    ico = normalizeIco(input);
  } catch {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(ico[i]) * (8 - i);
  const rem = sum % 11;
  const check = rem === 0 ? 1 : rem === 1 ? 0 : 11 - rem;
  return check === Number(ico[7]);
}

/** České DIČ: CZ + 8–10 číslic (firma = CZ + IČO). Ověření v registru plátců je věc ARES/ADIS. */
export function isValidCzDic(input: string): boolean {
  return /^CZ\d{8,10}$/.test(input.replace(/\s/g, "").toUpperCase());
}
