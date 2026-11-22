import { formatCzk } from "@iremeslo/core";
import { toHundredths } from "./money";

/** "2026-12-01" → "1. 12. 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

/** Částka z databáze ("1234.50") → "1 234,50 Kč" */
export function czk(dbValue: string | number | null | undefined): string {
  return formatCzk(toHundredths(dbValue));
}
