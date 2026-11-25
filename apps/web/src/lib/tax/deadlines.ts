/**
 * Daňové a odvodové termíny pro OSVČ a malé firmy. Připadne-li konec lhůty na víkend nebo svátek,
 * posouvá se na nejbližší pracovní den (§ 33 daňového řádu).
 */

function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function isHoliday(d: Date): boolean {
  const y = d.getUTCFullYear();
  const md = iso(d).slice(5);
  if (["01-01", "05-01", "05-08", "07-05", "07-06", "09-28", "10-28", "11-17", "12-24", "12-25", "12-26"].includes(md)) return true;
  const e = easterSunday(y).getTime();
  return d.getTime() === e - 2 * 86_400_000 || d.getTime() === e + 86_400_000; // Velký pátek, Velikonoční pondělí
}

export function workday(y: number, m: number, day: number): string {
  const d = new Date(Date.UTC(y, m - 1, day));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || isHoliday(d)) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

export interface Deadline { date: string; title: string; detail: string; kind: "dph" | "pojisteni" | "dan" | "info" }

export interface DeadlineProfile { legalForm: "osvc" | "po"; regime: "actual" | "flat_expenses" | "flat_tax"; vatPayer: boolean; hasEmployees?: boolean }

/** Termíny od `today` na `days` dní dopředu, seřazené podle data. */
export function upcomingDeadlines(p: DeadlineProfile, today: string, days = 75): Deadline[] {
  const out: Deadline[] = [];
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

  for (let k = -1; k <= 3; k++) {
    // měsíc, za který se platí (k = -1: minulý měsíc)
    const d0 = new Date(Date.UTC(ty, tm - 1 + k, 1));
    const y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1;
    const next = new Date(Date.UTC(y, m, 1));
    const ny = next.getUTCFullYear(), nm = next.getUTCMonth() + 1;
    const label = `${MONTHS[m - 1]} ${y}`;

    if (p.legalForm === "osvc" && p.regime !== "flat_tax") {
      out.push({ date: workday(ny, nm, 8), kind: "pojisteni", title: "Záloha na zdravotní pojištění", detail: `za ${label} – na účet své zdravotní pojišťovny` });
      out.push({ date: workday(ny, nm, 20), kind: "pojisteni", title: "Záloha na sociální pojištění", detail: `za ${label} – na účet OSSZ` });
    }
    if (p.legalForm === "osvc" && p.regime === "flat_tax") {
      out.push({ date: workday(y, m, 20), kind: "dan", title: "Paušální daň", detail: `za ${label} – jedna platba finančnímu úřadu` });
    }
    if (p.vatPayer) {
      out.push({ date: workday(ny, nm, 25), kind: "dph", title: "Přiznání k DPH a kontrolní hlášení", detail: `za ${label} (měsíční plátce) – podání a zaplacení DPH` });
    }
  }

  // Roční termíny
  for (const y of [ty, ty + 1]) {
    const prev = y - 1;
    if (p.legalForm === "osvc" && p.regime === "flat_tax") {
      out.push({ date: workday(y, 1, 10), kind: "info", title: "Oznámení o vstupu do paušálního režimu", detail: `na rok ${y} – pokud v něm chcete pokračovat, už se znovu nehlásíte` });
      continue;
    }
    out.push({ date: workday(y, 4, 1), kind: "dan", title: `Daňové přiznání za rok ${prev} (papírově)`, detail: "a zaplacení daně" });
    out.push({ date: workday(y, 5, 1 + 1), kind: "dan", title: `Daňové přiznání za rok ${prev} (elektronicky)`, detail: "přes datovou schránku nebo portál MOJE daně – a zaplacení daně" });
    if (p.legalForm === "osvc") {
      out.push({ date: workday(y, 6, 2), kind: "pojisteni", title: `Přehledy pro ČSSZ a zdravotní pojišťovnu za rok ${prev}`, detail: "do měsíce po lhůtě pro elektronické přiznání; doplatky do 8 dnů od podání" });
    }
    if (p.legalForm === "osvc") {
      out.push({ date: workday(y, 1, 10), kind: "info", title: "Lhůta pro vstup do paušální daně", detail: `oznámení na rok ${y}, pokud ještě nejste v paušálním režimu` });
    }
  }

  return out.filter((d) => d.date >= today && d.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "cs"));
}
