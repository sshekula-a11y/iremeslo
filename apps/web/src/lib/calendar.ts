/**
 * Kalendářní počty nad texty "YYYY-MM-DD" (počítáno v UTC, aby letní čas neposouval dny).
 */

export const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
export const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const WEEKDAYS_LONG = ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** 0 = pondělí … 6 = neděle */
export function weekday(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7;
}

/** "2026-11" z ?m=…, jinak měsíc z `today`. */
export function parseMonth(value: string | undefined, today: string): { year: number; month: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "");
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(year: number, month: number, by: number): string {
  const i = year * 12 + (month - 1) + by;
  return monthKey(Math.floor(i / 12), (i % 12) + 1);
}

/** Dny mřížky měsíce: celé týdny od pondělí do neděle. */
export function monthGrid(year: number, month: number): { first: string; last: string; days: string[] } {
  const first = `${monthKey(year, month)}-01`;
  const last = addDays(shiftMonth(year, month, 1) + "-01", -1);
  const start = addDays(first, -weekday(first));
  const end = addDays(last, 6 - weekday(last));
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return { first, last, days };
}

/** Zakázka v daném dni? Bez data „do“ trvá jen den „od“. */
export function coversDay(dateFrom: string, dateTo: string | null, day: string): boolean {
  return dateFrom <= day && day <= (dateTo ?? dateFrom);
}

/** "2026-11-23" → "pondělí 23. 11." */
export function dayLabel(iso: string): string {
  return `${WEEKDAYS_LONG[weekday(iso)]} ${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}.`;
}

/** Dnešek v Praze (server běží v UTC). */
export function todayInPrague(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(now);
}
