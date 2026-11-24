import { formatDate } from "@/lib/format";

/** Kategorie veřejných poptávek (stejné hodnoty hlídá databáze, migrace 012). */
export const INQUIRY_CATEGORIES = [
  ["malovani", "Malování a natěračství"],
  ["fasady", "Fasády a zateplení"],
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

export const INQUIRY_TERMS = [
  ["asap", "Co nejdříve"],
  ["month", "Do měsíce"],
  ["quarter", "Do 3 měsíců"],
  ["flexible", "Termín je flexibilní"],
  ["date", "Nejpozději do data"],
] as const;

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
  term: string;
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

export function formatTerm(term: string, date: string | null): string {
  if (term === "date" && date) return `Nejpozději do ${formatDate(date)}`;
  return (Object.fromEntries(INQUIRY_TERMS) as Record<string, string>)[term] ?? "";
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
