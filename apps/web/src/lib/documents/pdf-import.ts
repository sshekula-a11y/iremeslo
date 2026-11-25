/**
 * Čtení vydaných faktur z PDF jiných programů (FakturaOnline, Fakturoid, iDoklad, Pohoda…):
 * číslo, druh, data, odběratel, IČO a částka k úhradě. Text se skládá do řádků podle polohy na stránce,
 * takže se dvousloupcové bloky DODAVATEL / ODBĚRATEL dají oddělit.
 * Co se nepodaří přečíst, zůstane prázdné – uživatel to před uložením doplní.
 */

export interface TextItem { str: string; x: number; y: number; w?: number }
export interface Line { y: number; items: TextItem[]; text: string }

export interface ParsedInvoice {
  kind: "invoice" | "advance";
  number: string;
  issueDate: string;
  dueDate: string;
  customerName: string;
  customerIco: string;
  total: string; // „94740.00“
  vatPayer: boolean | null;
  source: string;
}

/**
 * Položky textu (z pdf.js) → řádky shora dolů. pdf.js dělí slova u diakritiky („ODB“ „Ě“ „RATEL“),
 * proto se položky, které na sebe navazují, slepí do úseků; větší mezera = nový sloupec.
 */
export function toLines(items: TextItem[]): Line[] {
  const sorted = items.filter((i) => i.str !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const it of sorted) {
    const r = rows.find((x) => Math.abs(x.y - it.y) < 3);
    if (r) r.items.push(it); else rows.push({ y: it.y, items: [it] });
  }
  const lines: Line[] = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    const segs: TextItem[] = [];
    for (const it of r.items) {
      const prev = segs[segs.length - 1];
      const prevEnd = prev ? prev.x + (prev.w ?? prev.str.length * 4.5) : 0;
      const gap = prev ? it.x - prevEnd : Infinity;
      if (prev && gap < 12) {
        prev.str += (gap > 1.5 && !prev.str.endsWith(" ") && !it.str.startsWith(" ") ? " " : "") + it.str;
        prev.w = it.x + (it.w ?? it.str.length * 4.5) - prev.x;
      } else segs.push({ ...it });
    }
    for (const sg of segs) sg.str = sg.str.replace(/\s+/g, " ").trim();
    const items = segs.filter((sg) => sg.str);
    if (items.length) lines.push({ y: r.y, items, text: items.map((i) => i.str).join(" ") });
  }
  return lines.sort((a, b) => b.y - a.y);
}

const DATE = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/;
const iso = (m: RegExpMatchArray | null) => (m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "");
/** „94 740,00 Kč“ → „94740.00“ */
const amount = (s: string) => {
  const m = s.match(/(-?\d{1,3}(?:[  .]\d{3})*(?:,\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)\s*(?:Kč|CZK)?\s*$/);
  if (!m) return "";
  const n = Number(m[1].replace(/[  ]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : "";
};

function dateAfter(lines: Line[], label: RegExp): string {
  for (const l of lines) {
    const i = l.text.search(label);
    if (i >= 0) { const m = l.text.slice(i).match(DATE); if (m) return iso(m); }
  }
  return "";
}

export function parseInvoiceLines(lines: Line[], fileName = ""): ParsedInvoice {
  const all = lines.map((l) => l.text).join("\n");
  const advance = /z[aá]lohov[aá]\s+faktura|v[yý]zva\s+k\s+platb[eě]|proforma/i.test(all) || /zaloh/i.test(fileName);
  const numberMatch = all.match(/(?:FAKTURA|faktura|DOKLAD|doklad)[^\n]*?(?:č\.|číslo|c\.)\s*:?\s*([A-Z0-9][\w/-]*)/)
    ?? all.match(/Variabilní symbol\s*:?\s*(\d+)/i)
    ?? fileName.match(/(\d{4,})/);
  const number = numberMatch?.[1] ?? "";

  // Odběratel: řádky pod nadpisem ODBĚRATEL ve stejném sloupci (vpravo od DODAVATELE).
  let customerName = "", customerIco = "";
  const head = lines.findIndex((l) => /ODB[ĚE]RATEL/i.test(l.text));
  if (head >= 0) {
    const label = lines[head].items.find((i) => /ODB[ĚE]RATEL/i.test(i.str))!;
    const supplierLabel = lines[head].items.find((i) => /DODAVATEL/i.test(i.str));
    const minX = supplierLabel && supplierLabel.x < label.x ? (supplierLabel.x + label.x) / 2 : label.x - 5;
    const col = (l: Line) => l.items.filter((i) => i.x >= minX).map((i) => i.str.trim()).join(" ").replace(/\s+/g, " ").trim();
    for (const l of lines.slice(head + 1, head + 12)) {
      const t = col(l);
      if (!t) continue;
      if (!customerName) { customerName = t; continue; }
      const ico = t.match(/I[ČC]O?\s*:?\s*(\d{6,8})/);
      if (ico) { customerIco = ico[1].padStart(8, "0"); break; }
      if (/Platební údaje|Číslo účtu|Datum vystavení/i.test(t)) break;
    }
  }

  const totalLine = [...lines].reverse().find((l) => /celkem k úhradě|k úhradě|k zaplacení|celkem/i.test(l.text) && /\d/.test(l.text));
  const total = totalLine ? amount(totalLine.text) : "";
  const vatPayer = /neplátce DPH|není plátce|nejsem plátce/i.test(all) ? false : /DIČ|DPH\s*\d{1,2}\s*%/.test(all) ? true : null;
  const source = all.match(/Vygenerováno pomocí ([\w.-]+)/)?.[1] ?? all.match(/(Fakturoid|iDoklad|Pohoda|Money S3|ABRA)/i)?.[1] ?? "";

  return {
    kind: advance ? "advance" : "invoice",
    number,
    issueDate: dateAfter(lines, /Datum vystavení/i),
    dueDate: dateAfter(lines, /Datum splatnosti|Splatnost/i),
    customerName,
    customerIco,
    total,
    vatPayer,
    source,
  };
}
