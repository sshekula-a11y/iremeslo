/**
 * Čtení údajů z českých účtenek a přijatých faktur bez AI – z textu (PDF nebo rozpoznaný z fotky)
 * a z QR Platby. Hledá IČO, datum, celkovou částku, rekapitulaci DPH, číslo dokladu, způsob platby
 * a odhadne kategorii výdaje. Text z fotky bývá s chybami, proto jsou pravidla tolerantní
 * a vše, co se nenajde, zůstane prázdné – uživatel údaje před uložením zkontroluje.
 */
import { isValidIco } from "./ico.ts";

export interface ReceiptGuess {
  kind: "receipt" | "invoice";
  /** název dodavatele z textu (záloha, když ARES neodpoví) */
  supplierName: string | null;
  supplierIco: string | null;
  docNumber: string | null;
  issueDate: string | null; // YYYY-MM-DD
  total: number | null;
  vatBase: number | null;
  vat: number | null;
  paidMethod: "card" | "cash" | "bank" | null;
  category: string | null;
  /** které údaje se podařilo najít (pro hlášku uživateli) */
  found: string[];
}

/** Bez diakritiky a malými písmeny – OCR diakritiku často ztrácí. */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Částky ve tvaru 1 873,50 / 1.873,50 / 1873.50 / 1873,- (vrací čísla v pořadí výskytu). */
export function amountsIn(line: string): number[] {
  const out: number[] = [];
  const re = /(?<![\d.,])(-?\d{1,3}(?:[  .]\d{3})+|-?\d+)(?:([.,])(\d{2})(?!\d)|,-)(?![\d%])/g;
  for (const m of line.matchAll(re)) {
    const whole = m[1].replace(/[  .]/g, "");
    const n = Number(`${whole}.${m[3] ?? "00"}`);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function validDate(d: number, m: number, y: number, today: string): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso) return null;
  if (iso > today) return null; // doklad z budoucnosti je špatně přečtený
  const twoYears = new Date(Date.parse(`${today}T12:00:00Z`) - 730 * 86_400_000).toISOString().slice(0, 10);
  return iso >= twoYears ? iso : null;
}

function datesIn(line: string, today: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/(?<!\d)(\d{1,2})\s?[.\/-]\s?(\d{1,2})\s?[.\/-]\s?(\d{4}|\d{2})(?!\d)/g)) {
    const iso = validDate(Number(m[1]), Number(m[2]), Number(m[3]), today);
    if (iso) out.push(iso);
  }
  for (const m of line.matchAll(/(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/g)) {
    const iso = validDate(Number(m[3]), Number(m[2]), Number(m[1]), today);
    if (iso) out.push(iso);
  }
  return out;
}

const TOTAL_KEYS = [
  /celkem\s*k\s*uhrade/, /k\s*uhrade/, /k\s*zaplaceni/, /celkem\s*(kc|czk)/, /celkova\s*castka/, /celkem\s*s\s*dph/,
  /celkem/, /soucet/, /suma/, /total/, /zaplaceno/, /platba\s*kartou/,
];

const CATEGORY_KEYS: [string, RegExp][] = [
  ["phm", /benzin|nafta|diesel|natural\s*95|natural95|motorova|lpg|cerpaci|shell|orlen|benzina|omv|eurooil|mol\s|tank\s?ono|robin\s?oil|pumpa/],
  ["auto", /servis|pneu|dalnicni|znamka|parkov|myc(ka|i)|stk\b|autodily|autoservis|olej\s*motor/],
  ["telefon", /\bo2\b|t-mobile|vodafone|internet|tarif|mobilni/],
  ["naradi", /vrtak|bity?\b|pila|makita|bosch|narex|dewalt|metabo|hilti|festool|rukavice|ochrann|pracovni\s*odev|naradi|kladivo|sroubovak/],
  ["material", /barva|omitka|lepidlo|cement|beton|sadrokarton|tmel|silikon|penetrace|hmozdink|sroub|pena|izolac|dlazb|obklad|laminat|primalex|hornbach|bauhaus|\bobi\b|dek\s|ptacek|raab|stavebnin|stavebniny|malir|valecek|stetec|paska|folie|cihl|pisek/],
  ["kancelar", /papir|toner|kancelar|office|software|licence|ucetni/],
  ["reklama", /reklama|tisk|vizitk|letak|inzerce|web\s*hosting|domena/],
  ["najem", /najem|najemne|elektrin|plyn\b|energie|cez\b|pre\b|eon\b|innogy/],
  ["pojisteni", /pojisten|pojistovna|kooperativa|allianz|generali|uniqa|csob\s*poj/],
];

/** Hlavní funkce: odhad údajů z textu dokladu. `ownIco` = IČO vlastní firmy (na faktuře je to odběratel). */
export function parseReceiptText(text: string, today: string, ownIco?: string | null): ReceiptGuess {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const low = lines.map(plain);
  const all = low.join("\n");
  const found: string[] = [];

  // Faktura vs. účtenka
  const kind: ReceiptGuess["kind"] = /faktura|danovy\s*doklad\s*c|odberatel/.test(all) && /odberatel|prijemce/.test(all) ? "invoice" : "receipt";

  // IČO: u faktury nejdřív v bloku dodavatele; IČO vlastní firmy (odběratele) přeskočíme
  const icos: { ico: string; i: number }[] = [];
  low.forEach((l, i) => {
    for (const m of l.matchAll(/\bi\s?c\s?o?\b\s*[:.]?\s*((?:\d\s?){6,8})(?!\d)/g)) {
      const ico = m[1].replace(/\s/g, "").padStart(8, "0");
      if (isValidIco(ico)) icos.push({ ico, i });
    }
    for (const m of l.matchAll(/\bdic\b\s*[:.]?\s*cz\s?(\d{8})(?!\d)/g)) {
      if (isValidIco(m[1])) icos.push({ ico: m[1], i });
    }
  });
  const buyerAt = low.findIndex((l) => /odberatel|prijemce|zakaznik/.test(l));
  const supplierIco = icos.find((x) => x.ico !== ownIco && (buyerAt < 0 || x.i < buyerAt || kind === "receipt"))?.ico
    ?? icos.find((x) => x.ico !== ownIco)?.ico ?? null;
  if (supplierIco) found.push("IČO");

  // Datum: nejdřív u klíčových slov, jinak první platné
  let issueDate: string | null = null;
  const dateKeys = [/datum\s*(vystaveni|uskutecneni|prodeje|nakupu)|duzp|vystaveno/, /datum|dne|cas\b/];
  for (const key of dateKeys) {
    for (let i = 0; i < low.length && !issueDate; i++) {
      if (key.test(low[i])) issueDate = datesIn(lines[i], today)[0] ?? (lines[i + 1] ? datesIn(lines[i + 1], today)[0] ?? null : null);
    }
    if (issueDate) break;
  }
  issueDate ??= lines.flatMap((l) => datesIn(l, today))[0] ?? null;
  if (issueDate) found.push("datum");

  // Celková částka: podle priority klíčových slov; na řádku poslední částka (u „celkem“ bývá vpravo)
  let total: number | null = null;
  for (const key of TOTAL_KEYS) {
    for (let i = low.length - 1; i >= 0; i--) {
      if (!key.test(low[i]) || /bez\s*dph|zaklad|vraceno|vratit/.test(low[i])) continue;
      const a = amountsIn(lines[i]).filter((n) => n > 0);
      const next = a.length ? a : lines[i + 1] ? amountsIn(lines[i + 1]).filter((n) => n > 0) : [];
      if (next.length) { total = next[next.length - 1]; break; }
    }
    if (total !== null) break;
  }
  if (total !== null) found.push("částka");

  // Rekapitulace DPH: řádky se sazbou 21 % / 12 % a dvěma částkami (základ, daň), které k sobě sedí
  let vatBase = 0, vat = 0, vatRows = 0;
  for (const l of lines) {
    const rate = l.match(/(?<!\d)(21|12|15|10)\s?%/);
    if (!rate) continue;
    const a = amountsIn(l.replace(/(?<!\d)(21|12|15|10)\s?%/, " "));
    for (let k = 0; k + 1 < a.length; k++) {
      const [b, v] = [a[k], a[k + 1]];
      if (b > 0 && Math.abs(b * Number(rate[1]) / 100 - v) <= Math.max(0.02 * v, 1)) { vatBase += b; vat += v; vatRows++; break; }
    }
  }
  if (vatRows) found.push("DPH");

  // Číslo dokladu
  let docNumber: string | null = null;
  for (let i = 0; i < low.length && !docNumber; i++) {
    const m = lines[i].match(/(?:faktura|doklad|uctenka|účtenka|účet|uctu|paragon|c\.\s*dokladu|cislo\s*dokladu|číslo\s*dokladu|var(?:iabilni|iabilní)?\.?\s*symbol|vs)\s*(?:c\.|č\.|cislo|číslo|:)?\s*[:#]?\s*([A-Z0-9][A-Z0-9/\-]{2,24})/i);
    if (m && /\d/.test(m[1])) docNumber = m[1];
  }
  if (docNumber) found.push("číslo dokladu");

  // Název dodavatele: první řádek s právní formou (s.r.o., a.s., spol. s r.o.) – vezmeme text jen do jejího konce,
  // protože u faktur ve dvou sloupcích bývá na stejném řádku i odběratel. Jinak první řádek s písmeny (ne nadpis).
  const LEGAL = /(spol\.\s?s\s?r\.\s?o\.?|s\.\s?r\.\s?o\.?|a\.\s?s\.|k\.\s?s\.|v\.\s?o\.\s?s\.|spol\.)/i;
  const LABEL = /^(dodavatel|prodavajici|prodávající)\s*:?\s*/i;
  let supplierName: string | null = null;
  for (const l of lines) {
    const t = l.replace(LABEL, "");
    if (/^(odberatel|odběratel|prijemce|příjemce)/i.test(t)) continue;
    const m = t.match(LEGAL);
    if (m && m.index !== undefined && m.index > 1) { supplierName = t.slice(0, m.index + m[0].length).trim(); break; }
  }
  supplierName ??= lines.slice(0, 3).map((l) => l.replace(LABEL, "").trim())
    .find((l) => /[a-zá-ž]{3}/i.test(l) && !/^(odberatel|odběratel|faktura|uctenka|účtenka|doklad|datum)/i.test(plain(l))) ?? null;
  supplierName = supplierName ? supplierName.replace(/,?\s*(ičo?|ic|dič|dic)\b.*$/i, "").trim().slice(0, 120) || null : null;

  const paidMethod: ReceiptGuess["paidMethod"] = /karta|kartou|visa|mastercard|maestro|terminal|contactless|bezkontakt/.test(all) ? "card"
    : /hotov/.test(all) ? "cash" : kind === "invoice" && /prevodem|bankovni|iban|cislo\s*uctu/.test(all) ? "bank" : null;
  const category = CATEGORY_KEYS.find(([, re]) => re.test(all))?.[0] ?? null;

  return {
    kind, supplierName, supplierIco, docNumber, issueDate, total,
    vatBase: vatRows ? Math.round(vatBase * 100) / 100 : null,
    vat: vatRows ? Math.round(vat * 100) / 100 : null,
    paidMethod, category, found,
  };
}

/** QR Platba (SPAYD): „SPD*1.0*ACC:CZ…*AM:1873.50*CC:CZK*X-VS:123*DT:20261120“. */
export function parseSpaydText(raw: string): { amount: number | null; vs: string | null; dueDate: string | null; iban: string | null } | null {
  if (!/^SPD\*1\.0\*/.test(raw.trim())) return null;
  const f = Object.fromEntries(raw.trim().split("*").slice(2).map((p) => [p.slice(0, p.indexOf(":")), p.slice(p.indexOf(":") + 1)]));
  const am = Number(f.AM);
  const dt = typeof f.DT === "string" && /^\d{8}$/.test(f.DT) ? `${f.DT.slice(0, 4)}-${f.DT.slice(4, 6)}-${f.DT.slice(6, 8)}` : null;
  return {
    amount: Number.isFinite(am) && am > 0 ? am : null,
    vs: typeof f["X-VS"] === "string" && /^\d{1,10}$/.test(f["X-VS"]) ? f["X-VS"] : null,
    dueDate: dt,
    iban: typeof f.ACC === "string" ? f.ACC.split("+")[0] : null,
  };
}
