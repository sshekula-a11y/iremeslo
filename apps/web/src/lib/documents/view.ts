import { formatCzk, type Party, type QuoteSnapshot } from "@iremeslo/core";
import { formatDate } from "@/lib/format";
import { toInput } from "@/lib/money";
import { THEMES, type ThemeKey } from "./themes";

/**
 * Doklad připravený k vykreslení: jen hotové texty. Stejný model kreslí náhled na obrazovce i PDF,
 * takže se nemohou rozejít.
 */
export interface DocumentView {
  heading: string;
  number: string;
  title: string;
  accent: string;
  accentText: string;
  logoUrl: string | null;
  supplier: { name: string; lines: string[] };
  customer: { name: string; lines: string[] } | null;
  meta: { label: string; value: string }[];
  columns: { description: string; qty: string; unit: string; unitPrice: string; total: string };
  rows: { description: string; qty: string; unit: string; unitPrice: string; total: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  notes: string[];
  footer: string;
}

export interface DocumentMeta {
  number: string;
  issueDate: string | null;
  validUntil: string | null;
  theme: string;
  logoUrl: string | null;
}

const qty = (n: number) => toInput(n) || "0";
const money = (n: number) => formatCzk(n, { withCurrency: false });

function partyLines(p: Party): string[] {
  const address = [p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [
    address,
    [p.ico ? `IČO ${p.ico}` : null, p.dic ? `DIČ ${p.dic}` : null].filter(Boolean).join(" · "),
    [p.phone, p.email].filter(Boolean).join(" · "),
    p.web ?? "",
    p.registerEntry ?? "",
  ].filter((l) => l.trim() !== "");
}

export function quoteView(s: QuoteSnapshot, m: DocumentMeta): DocumentView {
  const theme = THEMES[(m.theme in THEMES ? m.theme : "oranzova") as ThemeKey];
  const term = s.dateFrom ? (s.dateTo && s.dateTo !== s.dateFrom ? `${formatDate(s.dateFrom)} – ${formatDate(s.dateTo)}` : formatDate(s.dateFrom)) : null;
  const payer = s.vatPayer && s.vatMode === "standard";

  const totals: DocumentView["totals"] = [];
  if (s.totals.discount > 0) {
    totals.push({ label: "Mezisoučet", value: money(s.totals.subtotal) });
    totals.push({ label: "Sleva", value: `−${money(s.totals.discount)}` });
  }
  if (payer) {
    totals.push({ label: "Celkem bez DPH", value: money(s.totals.net) });
    totals.push({ label: `DPH ${s.totals.vatRate} %`, value: money(s.totals.vat) });
    totals.push({ label: "Celkem s DPH", value: formatCzk(s.totals.gross), strong: true });
  } else {
    totals.push({ label: "Celkem", value: formatCzk(s.totals.gross), strong: true });
  }

  return {
    heading: "Cenová nabídka",
    number: m.number,
    title: s.title,
    accent: theme.accent,
    accentText: theme.accentText,
    logoUrl: m.logoUrl,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: s.customer ? { name: s.customer.name, lines: partyLines(s.customer) } : null,
    meta: [
      { label: "Datum vystavení", value: formatDate(m.issueDate) },
      { label: "Platnost do", value: formatDate(m.validUntil) },
      ...(term ? [{ label: "Termín realizace", value: term }] : []),
      ...(s.siteAddress ? [{ label: "Místo realizace", value: s.siteAddress }] : []),
    ],
    columns: { description: "Položka", qty: "Množství", unit: "J.", unitPrice: payer ? "Cena/j bez DPH" : "Cena/j", total: payer ? "Celkem bez DPH" : "Celkem" },
    rows: s.lines.map((l) => ({ description: l.description, qty: qty(l.qty), unit: l.unit, unitPrice: money(l.unitPrice), total: money(l.total) })),
    totals,
    notes: [...s.notes, ...(s.note ? [s.note] : [])],
    footer: m.validUntil ? `Nabídka platí do ${formatDate(m.validUntil)}. Ceny jsou v Kč.` : "Ceny jsou v Kč.",
  };
}
