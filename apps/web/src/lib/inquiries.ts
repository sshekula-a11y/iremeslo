import { formatDate } from "@/lib/format";

/** Kategorie veřejných poptávek (stejné hodnoty hlídá databáze, migrace 012 a 017). */
export const INQUIRY_CATEGORIES = [
  ["malovani", "Malování a natěračství"],
  ["fasady", "Fasády a zateplení"],
  ["cisteni", "Čištění střech, fasád a dlažeb"],
  ["renovace", "Renovace exteriérů nemovitostí"],
  ["strechy", "Střechy a klempířství"],
  ["podlahy", "Podlahy"],
  ["obklady", "Obklady a dlažby"],
  ["zednicke", "Zednické práce a rekonstrukce"],
  ["instalace", "Voda, topení, plyn"],
  ["elektro", "Elektroinstalace"],
  ["tesarske", "Tesařské a truhlářské práce"],
  ["zahrada", "Zahrada a terénní úpravy"],
  ["uklid", "Úklid"],
  ["jine", "Jiné"],
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number][0];
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(INQUIRY_CATEGORIES);

export const INQUIRY_UNITS = [
  ["m2", "m²"],
  ["bm", "bm"],
  ["ks", "ks"],
  ["hod", "hod"],
  ["pausal", "paušál"],
] as const;
export const UNIT_LABEL: Record<string, string> = Object.fromEntries(INQUIRY_UNITS);

/** Volby termínu ve formuláři poptávky. */
export const INQUIRY_TERMS = [
  ["flexible", "Dohodou"],
  ["asap", "Ihned"],
  ["date", "Zadat vlastní"],
] as const;

/** Popisky všech uložených hodnot (month a quarter mají starší poptávky). */
const TERM_LABEL: Record<string, string> = { flexible: "Dohodou", asap: "Ihned", month: "Do měsíce", quarter: "Do 3 měsíců" };

/** Kraje (stejné hodnoty hlídá databáze, migrace 015). */
export const REGIONS = [
  ["praha", "Praha"],
  ["stredocesky", "Středočeský"],
  ["jihocesky", "Jihočeský"],
  ["plzensky", "Plzeňský"],
  ["karlovarsky", "Karlovarský"],
  ["ustecky", "Ústecký"],
  ["liberecky", "Liberecký"],
  ["kralovehradecky", "Královéhradecký"],
  ["pardubicky", "Pardubický"],
  ["vysocina", "Vysočina"],
  ["jihomoravsky", "Jihomoravský"],
  ["olomoucky", "Olomoucký"],
  ["zlinsky", "Zlínský"],
  ["moravskoslezsky", "Moravskoslezský"],
] as const;
export const REGION_LABEL: Record<string, string> = Object.fromEntries(REGIONS);

/** Kraj podle PSČ – stejné pravidlo jako app.region_from_zip. Jen předvyplnění, zadavatel ho může změnit. */
export function regionFromZip(zip: string): string | null {
  const d = zip.replace(/\D/g, "");
  if (d.length < 3) return null;
  const z = Number(d.slice(0, 3));
  const r = (a: number, b: number) => z >= a && z <= b;
  if (r(100, 199)) return "praha";
  if (r(250, 299)) return "stredocesky";
  if (r(300, 349)) return "plzensky";
  if (r(350, 364)) return "karlovarsky";
  if (r(393, 396)) return "vysocina";
  if (r(370, 399)) return "jihocesky";
  if (r(400, 449)) return "ustecky";
  if (r(460, 479) || r(511, 514)) return "liberecky";
  if (r(500, 519) || r(540, 552)) return "kralovehradecky";
  if (r(530, 539) || r(560, 572)) return "pardubicky";
  if (r(580, 595) || r(674, 676)) return "vysocina";
  if (r(686, 689) || r(755, 769)) return "zlinsky";
  if (r(600, 699)) return "jihomoravsky";
  if (z === 790 || r(750, 754) || r(770, 789) || r(796, 799)) return "olomoucky";
  if (r(700, 749) || r(791, 795)) return "moravskoslezsky";
  return null;
}

/** Filtr stáří v seznamu poptávek. */
export const INQUIRY_AGES = [
  ["1", "posledních 24 hodin"],
  ["7", "posledních 7 dní"],
  ["30", "posledních 30 dní"],
] as const;

export interface InquiryList {
  total: number;
  real_total: number;
  items: PublicInquiry[];
  /** Ukázky – jen dokud je skutečných aktivních poptávek méně než 5. */
  demo: PublicInquiry[];
}

export interface PublicInquiry {
  id: string;
  created_at: string;
  status: "open" | "closed" | "expired" | "pending" | "hidden";
  category: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  description: string;
  city: string;
  zip: string | null;
  region?: string | null;
  is_demo?: boolean;
  term: string;
  term_from?: string | null;
  term_date: string | null;
  expires_at: string;
  views: number;
}

export interface InquiryContact {
  name: string;
  phone: string | null;
  email: string;
  street: string | null;
  city: string;
  zip: string | null;
}

/** „500 m²“, „12 ks“, „paušál“ */
export function formatQuantity(q: number | null, unit: string | null): string | null {
  if (unit === "pausal") return "paušál";
  if (q === null || q === undefined) return null;
  const n = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(Number(q));
  return unit ? `${n} ${UNIT_LABEL[unit] ?? unit}` : n;
}

/** „Dohodou“, „Ihned“, „1. 12. 2026 – 15. 12. 2026“, „od 1. 12. 2026“, „do 15. 12. 2026“ */
export function formatTerm(term: string, date: string | null, from?: string | null): string {
  if (term === "date") {
    if (from && date) return `${formatDate(from)} – ${formatDate(date)}`;
    if (from) return `od ${formatDate(from)}`;
    if (date) return `do ${formatDate(date)}`;
  }
  return TERM_LABEL[term] ?? "";
}

/** „před 3 hodinami“, „včera“, „před 5 dny“ */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 60) return min <= 1 ? "právě teď" : `před ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "před hodinou" : `před ${h} hodinami`;
  const d = Math.round(h / 24);
  if (d === 1) return "včera";
  return `před ${d} dny`;
}
