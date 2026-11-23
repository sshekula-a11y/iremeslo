import { toDecimalString, type Money } from "./money.ts";
import { isValidIban, normalizeIban } from "./bank.ts";

/**
 * QR Platba – řetězec ve formátu SPAYD 1.0 (Short Payment Descriptor, standard ČBA).
 * Z tohoto textu se vykreslí QR kód na faktuře; bankovní aplikace ho načte jako platební příkaz.
 */

export interface SpaydInput {
  iban: string;
  bic?: string;
  amount: Money;
  currency?: "CZK" | "EUR";
  variableSymbol?: string;
  constantSymbol?: string;
  specificSymbol?: string;
  /** datum splatnosti YYYY-MM-DD */
  dueDate?: string;
  /** zpráva pro příjemce, max. 60 znaků */
  message?: string;
  /** jméno příjemce, max. 35 znaků */
  recipientName?: string;
}

/** Hvězdička odděluje pole, proto se v hodnotách kóduje; diakritika pryč kvůli starším bankovním aplikacím. */
function clean(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\*/g, "%2A")
    .trim()
    .slice(0, max);
}

function digits(value: string, max: number, what: string): string {
  if (!/^\d+$/.test(value) || value.length > max) throw new RangeError(`${what} může obsahovat jen číslice, nejvýše ${max}`);
  return value;
}

export function buildSpayd(p: SpaydInput): string {
  const iban = normalizeIban(p.iban);
  if (!isValidIban(iban)) throw new RangeError("neplatný IBAN");
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw new RangeError("částka k úhradě musí být kladná");
  const am = toDecimalString(p.amount);
  if (am.length > 10) throw new RangeError("částka je pro QR Platbu příliš vysoká");

  const parts = ["SPD", "1.0", `ACC:${iban}${p.bic ? `+${p.bic.toUpperCase()}` : ""}`, `AM:${am}`, `CC:${p.currency ?? "CZK"}`];
  if (p.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate)) throw new RangeError("datum splatnosti musí být YYYY-MM-DD");
    parts.push(`DT:${p.dueDate.replace(/-/g, "")}`);
  }
  if (p.message) parts.push(`MSG:${clean(p.message, 60)}`);
  if (p.recipientName) parts.push(`RN:${clean(p.recipientName, 35)}`);
  if (p.variableSymbol) parts.push(`X-VS:${digits(p.variableSymbol, 10, "variabilní symbol")}`);
  if (p.specificSymbol) parts.push(`X-SS:${digits(p.specificSymbol, 10, "specifický symbol")}`);
  if (p.constantSymbol) parts.push(`X-KS:${digits(p.constantSymbol, 10, "konstantní symbol")}`);
  return parts.join("*");
}
