import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * Import a export zákazníků: vCard (.vcf – telefon, Google, Outlook, iCloud), Excel (.xlsx), CSV a ZIP s nimi.
 * Běží v prohlížeči; do databáze jde až zkontrolovaný seznam.
 */

export interface ContactRow {
  kind: "person" | "company";
  name: string;
  ico: string;
  dic: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  zip: string;
  contact_person: string;
  note: string;
}

export const emptyRow = (): ContactRow => ({ kind: "person", name: "", ico: "", dic: "", phone: "", email: "", street: "", city: "", zip: "", contact_person: "", note: "" });

// ---------------------------------------------------------------------------
// vCard
// ---------------------------------------------------------------------------

function decodeQuotedPrintable(s: string, charset = "utf-8"): string {
  const bytes: number[] = [];
  const src = s.replace(/=\r?\n/g, "");
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "=" && /^[0-9A-F]{2}$/i.test(src.slice(i + 1, i + 3))) { bytes.push(parseInt(src.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(src.charCodeAt(i) & 0xff);
  }
  try { return new TextDecoder(charset).decode(new Uint8Array(bytes)); } catch { return new TextDecoder().decode(new Uint8Array(bytes)); }
}

const vUnescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
const vEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function parseVcf(text: string): ContactRow[] {
  // rozložení zalomených řádků (RFC 6350) a měkkých zalomení quoted-printable (vCard 2.1)
  const raw = text.replace(/\r\n/g, "\n").replace(/=\n/g, "=\u0000").replace(/\n[ \t]/g, "").replace(/=\u0000/g, "=\n");
  const out: ContactRow[] = [];
  for (const card of raw.split(/BEGIN:VCARD/i).slice(1)) {
    const r = emptyRow();
    let fn = "", org = "", nName = "";
    const notes: string[] = [];
    for (const line of card.split(/\n(?=[A-Za-z][\w.-]*[;:])/)) {
      const m = line.match(/^(?:[\w-]+\.)?([A-Za-z-]+)((?:;[^:]*)?):([\s\S]*)$/);
      if (!m) continue;
      const prop = m[1].toUpperCase();
      const params = m[2].toUpperCase();
      let value = m[3].replace(/\n$/, "");
      if (params.includes("QUOTED-PRINTABLE")) value = decodeQuotedPrintable(value, params.match(/CHARSET=([\w-]+)/)?.[1] ?? "utf-8");
      if (prop === "FN") fn = vUnescape(value);
      else if (prop === "N") {
        const [last = "", first = "", middle = ""] = value.split(/(?<!\\);/).map(vUnescape);
        nName = [first, middle, last].filter(Boolean).join(" ");
      } else if (prop === "ORG") org = vUnescape(value.split(/(?<!\\);/)[0] ?? "");
      else if (prop === "TEL" && !r.phone) r.phone = value.replace(/^tel:/i, "").trim();
      else if (prop === "EMAIL" && !r.email) r.email = vUnescape(value).toLowerCase();
      else if (prop === "ADR" && !r.street) {
        const [, , street = "", city = "", , zip = ""] = value.split(/(?<!\\);/).map(vUnescape);
        r.street = street.replace(/\n/g, ", "); r.city = city; r.zip = zip;
      } else if (prop === "NOTE") notes.push(vUnescape(value));
      else if (prop === "X-ICO" || prop === "X-IC") r.ico = value.replace(/\D/g, "");
      else if (prop === "X-DIC") r.dic = value.trim().toUpperCase();
    }
    const personName = fn || nName;
    if (org) { r.kind = "company"; r.name = org; if (personName && personName !== org) r.contact_person = personName; }
    else r.name = personName;
    r.note = notes.join(" ").slice(0, 500);
    if (r.name.trim()) out.push(r);
  }
  return out;
}

export function buildVcf(rows: ContactRow[]): string {
  return rows.map((r) => {
    const lines = ["BEGIN:VCARD", "VERSION:3.0"];
    if (r.kind === "company") {
      lines.push(`FN:${vEscape(r.contact_person || r.name)}`, `ORG:${vEscape(r.name)}`);
      lines.push(r.contact_person ? `N:${vEscape(r.contact_person.split(" ").slice(-1)[0])};${vEscape(r.contact_person.split(" ").slice(0, -1).join(" "))};;;` : `N:;;;;`);
    } else {
      const parts = r.name.trim().split(/\s+/);
      lines.push(`FN:${vEscape(r.name)}`, `N:${vEscape(parts.length > 1 ? parts.slice(-1)[0] : r.name)};${vEscape(parts.length > 1 ? parts.slice(0, -1).join(" ") : "")};;;`);
    }
    if (r.phone) lines.push(`TEL;TYPE=CELL:${r.phone}`);
    if (r.email) lines.push(`EMAIL;TYPE=INTERNET:${r.email}`);
    if (r.street || r.city || r.zip) lines.push(`ADR;TYPE=WORK:;;${vEscape(r.street)};${vEscape(r.city)};;${vEscape(r.zip)};Česko`);
    if (r.ico) lines.push(`X-ICO:${r.ico}`);
    if (r.dic) lines.push(`X-DIC:${r.dic}`);
    if (r.note) lines.push(`NOTE:${vEscape(r.note)}`);
    lines.push("END:VCARD");
    return lines.join("\r\n");
  }).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Tabulky (XLSX, CSV): sloupce se poznají podle záhlaví
// ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

type Col = keyof ContactRow | "first" | "last" | "street2";
function columnOf(header: string): Col | null {
  const h = norm(header);
  if (!h) return null;
  if (/^(typ|druh|type)$/.test(h)) return "kind";
  if (/^(ico|ic|ic o|identifikacni cislo|company id|company number|company no|registration number|business id|crn)$/.test(h)) return "ico";
  if (/^(dic|vat|vat id|vat number|vat no|danove identifikacni cislo|tax id|tax number)$/.test(h)) return "dic";
  if (/(country|zeme|stat)/.test(h) || /(invoices count|expenses count|pocet)/.test(h)) return null;
  if (/(prijmeni|last name|family name|surname)/.test(h)) return "last";
  if (/^(jmeno|first name|given name|krestni jmeno)$/.test(h)) return "first";
  if (/(kontaktni osoba|contact person)/.test(h)) return "contact_person";
  if (/(nazev|jmeno a prijmeni|jmeno nebo nazev|odberatel|zakaznik|firma|spolecnost|organization|company|^name$|full name|display name)/.test(h)) return "name";
  if (/(telefon|^tel|mobil|phone)/.test(h)) return "phone";
  if (/(e mail|email|mail)/.test(h)) return "email";
  if (/(psc|zip|postal|postcode)/.test(h)) return "zip";
  if (/(obec|mesto|city|town|locality)/.test(h)) return "city";
  if (/(ulice|adresa|street|address)/.test(h)) return h.includes("2") ? "street2" : "street";
  if (/(poznamka|note|notes)/.test(h)) return "note";
  return null;
}

/** Tabulka (první řádek = záhlaví) → kontakty. Bez rozpoznaného sloupce se jménem vrátí prázdný seznam. */
export function rowsFromTable(table: string[][]): ContactRow[] {
  const [head, ...body] = table.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const cols = head.map(columnOf);
  if (!cols.includes("name") && !cols.includes("first") && !cols.includes("last")) return [];
  const out: ContactRow[] = [];
  for (const cells of body) {
    const r = emptyRow();
    let first = "", last = "", street2 = "";
    cells.forEach((raw, i) => {
      const v = String(raw ?? "").trim();
      const c = cols[i];
      if (!c || !v) return;
      if (c === "first") first = v; else if (c === "last") last = v; else if (c === "street2") street2 = v;
      else if (c === "kind") r.kind = /firm|spol|compan|pravn/i.test(v) ? "company" : "person";
      else if (!r[c]) (r as unknown as Record<string, string>)[c] = v;
    });
    if (!r.name) r.name = [first, last].filter(Boolean).join(" ");
    if (street2) r.street = [r.street, street2].filter(Boolean).join(", ");
    if (/^\d{5}$/.test(r.zip)) r.zip = `${r.zip.slice(0, 3)} ${r.zip.slice(3)}`;
    if (r.city && r.street.toLowerCase().endsWith(`, ${r.city.toLowerCase()}`)) r.street = r.street.slice(0, -(r.city.length + 2)).trim();
    r.ico = r.ico.replace(/\D/g, "");
    if (r.ico && r.kind === "person" && !first && !last) r.kind = "company";
    r.email = r.email.toLowerCase();
    r.phone = formatPhone(r.phone);
    if (r.name.trim()) out.push(r);
  }
  return out;
}

/** České číslo do tvaru „+420 602 176 440“ (Excel z něj často udělá 420602176440). */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (/^(00)?420\d{9}$/.test(d)) { const n = d.slice(-9); return `+420 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`; }
  if (/^\d{9}$/.test(d) && /^[2-9]/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return raw.trim();
}

export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const firstLine = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : (firstLine.includes("\t") ? "\t" : ",");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const xmlDecode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const xmlEncode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // znaky, které XML nesmí obsahovat
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** První list XLSX jako tabulka textů. */
export function parseXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  const shared: string[] = [];
  for (const si of read("xl/sharedStrings.xml").match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    shared.push(xmlDecode((si.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
  }
  // první list podle workbook.xml (r:id → cesta), jinak sheet1
  const wb = read("xl/workbook.xml");
  const rid = wb.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const target = rid ? read("xl/_rels/workbook.xml.rels").match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`)) : null;
  const sheetPath = target ? `xl/${(target[1] ?? target[2]).replace(/^\/?xl\//, "").replace(/^\//, "")}` : "xl/worksheets/sheet1.xml";
  const sheet = read(sheetPath) || read("xl/worksheets/sheet1.xml");
  const table: string[][] = [];
  for (const rowXml of sheet.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
    const row: string[] = [];
    for (const c of rowXml.match(/<c\b[^>]*?\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = c.match(/\br="([A-Z]+)\d+"/)?.[1] ?? "";
      const col = ref ? ref.split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const t = c.match(/\bt="([^"]+)"/)?.[1];
      let v = "";
      if (t === "s") v = shared[Number(c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? -1)] ?? "";
      else if (t === "inlineStr") v = xmlDecode((c.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? []).map((x) => x.replace(/<[^>]+>/g, "")).join(""));
      else v = xmlDecode(c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      row[col] = v;
    }
    table.push(Array.from(row, (x) => x ?? ""));
  }
  return table;
}

export const TABLE_HEADER = ["Typ", "Jméno nebo název", "IČO", "DIČ", "Telefon", "E-mail", "Ulice", "Obec", "PSČ", "Kontaktní osoba", "Poznámka"];
export const tableRow = (r: ContactRow) => [r.kind === "company" ? "Firma" : "Osoba", r.name, r.ico, r.dic, r.phone, r.email, r.street, r.city, r.zip, r.contact_person, r.note];

/** Jednoduchý XLSX (jeden list, tučné záhlaví) – otevře ho Excel, Numbers i LibreOffice. */
export function buildXlsx(table: string[][]): Uint8Array {
  const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  const rows = table.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) =>
    `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEncode(String(v ?? ""))}</t></is></c>`).join("")}</row>`).join("");
  const widths = (table[0] ?? []).map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 1 ? 32 : 16}" customWidth="1"/>`).join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    "xl/workbook.xml": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Zákazníci" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    "xl/styles.xml": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetData>${rows}</sheetData></worksheet>`),
  };
  return zipSync(files, { level: 6 });
}

// ---------------------------------------------------------------------------
// Soubory → kontakty (i ZIP s více soubory)
// ---------------------------------------------------------------------------

export interface ParsedFile { file: string; rows: ContactRow[]; error?: string }

export function parseContactFile(name: string, bytes: Uint8Array): ParsedFile[] {
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith(".zip")) {
      const files = unzipSync(bytes);
      return Object.entries(files)
        .filter(([p, b]) => !p.endsWith("/") && !p.startsWith("__MACOSX") && b.length > 0)
        .flatMap(([p, b]) => parseContactFile(p, b));
    }
    if (lower.endsWith(".vcf") || lower.endsWith(".vcard")) return [{ file: name, rows: parseVcf(strFromU8(bytes)) }];
    if (lower.endsWith(".xlsx")) {
      const rows = rowsFromTable(parseXlsx(bytes));
      return [{ file: name, rows, error: rows.length ? undefined : "Nenašli jsme sloupec se jménem nebo názvem." }];
    }
    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      const text = (() => { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return new TextDecoder("windows-1250").decode(bytes); } })();
      const rows = rowsFromTable(parseCsv(text));
      return [{ file: name, rows, error: rows.length ? undefined : "Nenašli jsme sloupec se jménem nebo názvem." }];
    }
    if (lower.endsWith(".xls")) return [{ file: name, rows: [], error: "Starý formát .xls neumíme – v Excelu ho uložte jako .xlsx." }];
    return [{ file: name, rows: [], error: "Tento typ souboru neumíme – použijte .vcf, .xlsx, .csv nebo .zip." }];
  } catch {
    return [{ file: name, rows: [], error: "Soubor se nepodařilo přečíst." }];
  }
}
