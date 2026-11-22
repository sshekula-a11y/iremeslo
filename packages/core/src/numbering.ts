/**
 * Číselné řady dokladů. Formát se zapisuje se zástupnými znaky ve složených závorkách:
 * {RRRR} = rok čtyřmístně, {RR} = rok dvoumístně, {NNN} = pořadí doplněné nulami (počet N = počet míst).
 * Pořadí se přidělí v databázi (funkce next_document_number), aby v řadě nebyly mezery.
 */

export type DocumentType = "quote" | "advance" | "ddpp" | "invoice" | "invoice_non_payer" | "credit_note" | "contract" | "handover";

export const DEFAULT_SERIES: Record<DocumentType, string> = {
  quote: "CN-{RRRR}-{NNN}",
  advance: "ZF-{RRRR}-{NNN}",
  ddpp: "DD-{RRRR}-{NNN}",
  invoice: "FV-{RRRR}-{NNN}",
  invoice_non_payer: "{RRRR}{NNN}",
  credit_note: "DB-{RRRR}-{NNN}",
  contract: "SOD-{RRRR}-{NNN}",
  handover: "PP-{RRRR}-{NNN}",
};

const TOKEN = /\{(RRRR|RR|N+)\}/g;

export function validateSeriesFormat(format: string): void {
  const tokens = [...format.matchAll(TOKEN)].map((m) => m[1] ?? "");
  const n = tokens.filter((t) => t.startsWith("N"));
  if (n.length !== 1) throw new RangeError("formát řady musí obsahovat právě jedno {NNN}");
  if (!tokens.some((t) => t === "RRRR" || t === "RR")) throw new RangeError("formát řady musí obsahovat rok {RRRR} nebo {RR}");
  if (format.replace(TOKEN, "").length > 20) throw new RangeError("formát řady je příliš dlouhý");
}

export function formatDocumentNumber(format: string, year: number, seq: number): string {
  validateSeriesFormat(format);
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError("pořadí musí být kladné celé číslo");
  return format.replace(TOKEN, (_, t: string) => {
    if (t === "RRRR") return String(year).padStart(4, "0");
    if (t === "RR") return String(year % 100).padStart(2, "0");
    const s = String(seq);
    if (s.length > t.length) throw new RangeError(`pořadí ${seq} se nevejde do ${t.length} míst`);
    return s.padStart(t.length, "0");
  });
}

/** Variabilní symbol = číslice čísla faktury (max. 10), např. FV-2026-001 → 2026001. */
export function variableSymbolFromNumber(documentNumber: string): string {
  const digits = documentNumber.replace(/\D/g, "");
  if (digits.length === 0) throw new RangeError("číslo dokladu neobsahuje číslice");
  if (digits.length > 10) throw new RangeError("variabilní symbol může mít nejvýš 10 číslic");
  return digits;
}
