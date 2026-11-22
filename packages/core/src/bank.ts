/**
 * Kontrola českého čísla účtu, převod na IBAN a kontrola IBAN.
 * Číslo účtu: [předčíslí-]číslo/kód banky, předčíslí max. 6 číslic, číslo 2–10 číslic,
 * obě části musí projít kontrolou modulo 11 (váhy 6,3,7,9,10,5,8,4,2,1 zprava).
 */

const WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

function mod11Ok(digits: string): boolean {
  const padded = digits.padStart(10, "0");
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(padded[i]) * (WEIGHTS[i] ?? 0);
  return sum % 11 === 0;
}

export interface CzAccount {
  prefix: string;
  number: string;
  bankCode: string;
}

export function parseCzAccount(input: string): CzAccount {
  const s = input.replace(/\s/g, "");
  const m = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/.exec(s);
  if (!m) throw new RangeError("číslo účtu musí mít tvar [předčíslí-]číslo/kód banky");
  const prefix = m[1] ?? "";
  const number = m[2] ?? "";
  const bankCode = m[3] ?? "";
  if (prefix && !mod11Ok(prefix)) throw new RangeError("předčíslí účtu nemá platnou kontrolní číslici");
  if (!mod11Ok(number)) throw new RangeError("číslo účtu nemá platnou kontrolní číslici");
  return { prefix, number, bankCode };
}

/** Kontrolní číslice IBAN podle ISO 13616 (mod 97). */
function ibanChecksum(country: string, bban: string): string {
  const rearranged = bban + country + "00";
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return String(98 - rem).padStart(2, "0");
}

export function czAccountToIban(input: string): string {
  const a = parseCzAccount(input);
  const bban = a.bankCode + a.prefix.padStart(6, "0") + a.number.padStart(10, "0");
  return `CZ${ibanChecksum("CZ", bban)}${bban}`;
}

export function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase();
}

export function isValidIban(iban: string): boolean {
  const s = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  if (s.startsWith("CZ") && s.length !== 24) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  const numeric = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

/** IBAN po čtveřicích pro tisk na fakturu. */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})(?=.)/g, "$1 ");
}
