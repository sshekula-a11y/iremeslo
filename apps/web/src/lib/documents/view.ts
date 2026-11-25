import { formatCzk, formatIban, variableSymbol, type InvoiceSnapshot, type Party, type QuoteSnapshot } from "@iremeslo/core";
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
  stampUrl: string | null;
  signatureUrl: string | null;
  supplier: { name: string; lines: string[] };
  customer: { name: string; lines: string[] } | null;
  meta: { label: string; value: string }[];
  columns: { description: string; qty: string; unit: string; unitPrice: string; total: string };
  rows: { description: string; qty: string; unit: string; unitPrice: string; total: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  /** rekapitulace DPH (jen daňové doklady plátce) */
  recap: { label: string; base: string; vat: string; total: string; muted?: boolean }[] | null;
  /** platební údaje a QR Platba (faktura, záloha) */
  payment: { lines: { label: string; value: string }[]; amount: string; qrDataUrl: string | null } | null;
  notes: string[];
  footer: string;
  /** popisky stran místo „Dodavatel / Odběratel“ (smlouva: Zhotovitel / Objednatel) */
  partyLabels?: [string, string];
  /** články textu (smlouva o dílo, předávací protokol) – místo tabulky položek */
  articles?: { title: string; paragraphs: string[] }[];
  /** prázdné řádky k ručnímu vyplnění (předávací protokol) */
  blanks?: { label: string; lines: number }[];
  /** podpisy obou stran; vlevo razítko a podpis dodavatele z nastavení */
  signatures?: {
    left: string;
    right: string;
    place: boolean;
    /** podpis prstem (obrázek PNG jako data URL) a popisek pod ním */
    leftSigned?: SignedBy;
    rightSigned?: SignedBy;
    /** „V Brně dne 25. 11. 2026“ – vyplněno z podpisu */
    placeText?: string;
    /** poznámka o elektronickém podpisu a otisku dokladu */
    note?: string;
  };
}

export interface SignedBy { image: string; caption: string }

export interface DocumentMeta {
  number: string;
  issueDate: string | null;
  validUntil: string | null;
  theme: string;
  logoUrl: string | null;
  stampUrl?: string | null;
  signatureUrl?: string | null;
  taxableDate?: string | null;
  dueDate?: string | null;
  qrDataUrl?: string | null;
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
    stampUrl: m.stampUrl ?? null,
    signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: s.customer ? { name: s.customer.name, lines: partyLines(s.customer) } : null,
    meta: [
      { label: "Datum vystavení", value: formatDate(m.issueDate) },
      { label: "Platnost do", value: formatDate(m.validUntil) },
      ...(term ? [{ label: "Termín realizace", value: term }] : []),
      ...(s.siteAddress ? [{ label: "Místo realizace", value: s.siteAddress }] : []),
    ],
    columns: { description: "Položka", qty: "Množství", unit: "MJ", unitPrice: payer ? "Cena/j bez DPH" : "Cena/j", total: payer ? "Celkem bez DPH" : "Celkem" },
    rows: s.lines.map((l) => ({ description: l.description, qty: qty(l.qty), unit: l.unit, unitPrice: money(l.unitPrice), total: money(l.total) })),
    totals,
    recap: null,
    payment: null,
    notes: [...s.notes, ...(s.note ? [s.note] : [])],
    footer: m.validUntil ? `Nabídka platí do ${formatDate(m.validUntil)}. Ceny jsou v Kč.` : "Ceny jsou v Kč.",
  };
}

export const INVOICE_HEADINGS = {
  invoice: "Faktura – daňový doklad",
  invoice_non_payer: "Faktura",
  advance: "Zálohová faktura",
  ddpp: "Daňový doklad k přijaté platbě",
} as const;

export function invoiceHeading(s: InvoiceSnapshot): string {
  if (s.kind === "advance") return INVOICE_HEADINGS.advance;
  if (s.kind === "ddpp") return INVOICE_HEADINGS.ddpp;
  return s.vatPayer ? INVOICE_HEADINGS.invoice : INVOICE_HEADINGS.invoice_non_payer;
}

/** Faktura, zálohová faktura a DDPP. */
export function invoiceView(s: InvoiceSnapshot, m: DocumentMeta): DocumentView {
  const theme = THEMES[(m.theme in THEMES ? m.theme : "oranzova") as ThemeKey];
  const taxDoc = s.vatPayer && s.kind !== "advance";
  const standard = s.vatMode === "standard";
  const vs = variableSymbol(m.number);
  const rateLabel = (r: number) => (s.vatMode === "reverse_charge" ? "Přenesená daň. povinnost" : `${r} %`);

  // Součty pod položkami
  const totals: DocumentView["totals"] = [];
  if (s.kind === "advance") {
    totals.push({ label: "Záloha k úhradě", value: formatCzk(s.amountDue), strong: true });
  } else if (s.kind === "ddpp") {
    totals.push({ label: "Základ daně", value: money(s.recap[0]?.base ?? 0) });
    totals.push({ label: `DPH ${s.recap[0]?.rate ?? 0} %`, value: money(s.recap[0]?.vat ?? 0) });
    totals.push({ label: "Přijatá platba", value: formatCzk(s.amountDue), strong: true });
  } else {
    if (s.discount > 0) {
      totals.push({ label: "Mezisoučet", value: money(s.subtotal) });
      totals.push({ label: "Sleva", value: `−${money(s.discount)}` });
    }
    if (standard) {
      totals.push({ label: "Celkem bez DPH", value: money(s.recap.reduce((a, r) => a + r.base, 0)) });
      totals.push({ label: "DPH", value: money(s.recap.reduce((a, r) => a + r.vat, 0)) });
      totals.push({ label: "Celkem s DPH", value: money(s.total) });
    } else {
      totals.push({ label: "Celkem", value: money(s.total) });
    }
    for (const d of s.deductions) totals.push({ label: d.label, value: money(d.gross) });
    if (s.rounding !== 0) totals.push({ label: "Zaokrouhlení", value: money(s.rounding) });
    totals.push({ label: s.amountDue === 0 && s.deductions.length ? "Uhrazeno zálohami" : "K úhradě", value: formatCzk(s.amountDue), strong: true });
  }

  // Rekapitulace DPH (zákonná náležitost daňového dokladu plátce)
  let recap: DocumentView["recap"] = null;
  if (taxDoc) {
    recap = s.recap.map((r) => ({ label: rateLabel(r.rate), base: money(r.base), vat: money(r.vat), total: money(r.total) }));
    if (s.deductions.length) {
      for (const d of s.deductions) recap.push({ label: `Záloha ${d.advanceNumber}`, base: money(d.base), vat: money(d.vat), total: money(d.gross), muted: true });
      for (const r of s.recapAfterDeductions) recap.push({ label: `Zbývá ${rateLabel(r.rate)}`, base: money(r.base), vat: money(r.vat), total: money(r.total) });
    }
  }

  // Platební údaje a QR Platba
  let payment: DocumentView["payment"] = null;
  if (s.kind !== "ddpp" && s.amountDue > 0) {
    const lines: { label: string; value: string }[] = [];
    if (s.payment?.bankAccount) lines.push({ label: "Číslo účtu", value: s.payment.bankAccount });
    if (s.payment?.iban) lines.push({ label: "IBAN", value: formatIban(s.payment.iban) });
    if (s.payment?.bic) lines.push({ label: "BIC / SWIFT", value: s.payment.bic });
    lines.push({ label: "Variabilní symbol", value: vs });
    if (m.dueDate) lines.push({ label: "Datum splatnosti", value: formatDate(m.dueDate) });
    payment = { lines, amount: formatCzk(s.amountDue), qrDataUrl: m.qrDataUrl ?? null };
  }

  const meta: DocumentView["meta"] = [{ label: "Datum vystavení", value: formatDate(m.issueDate) }];
  if (s.kind === "invoice" && s.vatPayer) meta.push({ label: "Datum zdan. plnění", value: formatDate(m.taxableDate) });
  if (s.kind === "ddpp") meta.push({ label: "Datum přijetí platby", value: formatDate(m.taxableDate) });
  if (s.kind === "ddpp" && s.relatedNumber) meta.push({ label: "K záloze", value: s.relatedNumber });
  if (s.kind !== "ddpp") {
    meta.push({ label: "Datum splatnosti", value: formatDate(m.dueDate) });
    meta.push({ label: "Forma úhrady", value: "Převodem na účet" });
  }
  if (s.siteAddress && s.kind !== "ddpp") meta.push({ label: "Místo plnění", value: s.siteAddress });

  const priced = standard && s.kind !== "advance";
  return {
    heading: invoiceHeading(s),
    number: m.number,
    title: s.title,
    accent: theme.accent,
    accentText: theme.accentText,
    logoUrl: m.logoUrl,
    stampUrl: m.stampUrl ?? null,
    signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.customer.name, lines: partyLines(s.customer) },
    meta,
    columns: {
      description: s.kind === "advance" ? "Předmět zálohy" : "Položka",
      qty: "Množství",
      unit: "MJ",
      unitPrice: priced ? "Cena/j bez DPH" : "Cena/j",
      total: priced ? "Celkem bez DPH" : "Celkem",
    },
    rows: s.lines.map((l) => ({ description: l.description, qty: qty(l.qty), unit: l.unit, unitPrice: money(l.unitPrice), total: money(l.total) })),
    totals,
    recap,
    payment,
    notes: s.notes,
    footer: s.kind === "ddpp" ? "Ceny jsou v Kč." : `Při platbě uveďte variabilní symbol ${vs}. Ceny jsou v Kč.`,
  };
}

/** 1 → I, 4 → IV (články smlouvy) */
export function toRoman(n: number): string {
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}
