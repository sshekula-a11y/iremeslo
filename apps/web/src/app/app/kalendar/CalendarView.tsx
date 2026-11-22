import Link from "next/link";
import { STATUS_COLORS, STATUS_DOTS } from "@/components/StatusBadge";
import { JOB_STATUSES, type JobStatus } from "@/lib/labels";
import { MONTHS, WEEKDAYS, coversDay, dayLabel, monthGrid, monthKey, shiftMonth, weekday } from "@/lib/calendar";

export interface CalendarJob {
  id: string;
  title: string;
  status: JobStatus;
  dateFrom: string;
  dateTo: string | null;
  client: string | null;
  people: string[];
}

const MAX_IN_CELL = 3;

export function CalendarView({ year, month, today, jobs, undated }: { year: number; month: number; today: string; jobs: CalendarJob[]; undated: number }) {
  const { first, last, days } = monthGrid(year, month);
  const onDay = (day: string) => jobs.filter((j) => coversDay(j.dateFrom, j.dateTo, day));
  const thisMonth = monthKey(year, month) === today.slice(0, 7);
  // Mobil: jen dny s prací (a dnešek); v aktuálním měsíci od dneška dál, ať se nelistuje minulostí.
  const from = thisMonth ? today : first;
  const agenda = days.filter((d) => d >= from && d <= last).filter((d) => d === today || onDay(d).length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-extrabold">
          Kalendář <span className="font-bold text-muted">· {MONTHS[month - 1]} {year}</span>
        </h1>
        <nav className="flex items-center gap-2" aria-label="Měsíc">
          <Link className="btn-ghost px-3" href={`?m=${shiftMonth(year, month, -1)}`} aria-label="Předchozí měsíc">←</Link>
          {!thisMonth && <Link className="btn-ghost" href="?">Dnes</Link>}
          <Link className="btn-ghost px-3" href={`?m=${shiftMonth(year, month, 1)}`} aria-label="Další měsíc">→</Link>
          <Link className="btn-primary" href="/app/zakazky/nova">+ Zakázka</Link>
        </nav>
      </div>

      {/* Počítač a tablet: měsíční mřížka */}
      <div className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-line bg-paper text-[12px] font-semibold text-muted">
          {WEEKDAYS.map((w) => <div key={w} className="px-2 py-1.5">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const list = onDay(day);
            const outside = day < first || day > last;
            const weekend = weekday(day) >= 5;
            return (
              <div key={day} className={`min-h-28 border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${outside ? "bg-paper/70" : weekend ? "bg-paper/40" : ""}`}>
                <p className={`num mb-1 inline-flex size-6 items-center justify-center text-[13px] ${day === today ? "rounded-full bg-accent font-bold text-ink" : outside ? "text-muted/60" : "text-muted"}`}>
                  {Number(day.slice(8, 10))}
                </p>
                <ul className="space-y-1">
                  {list.slice(0, MAX_IN_CELL).map((j) => (
                    <li key={j.id}>
                      <Link href={`/app/zakazky/${j.id}`} title={`${j.title}${j.people.length ? " · " + j.people.join(", ") : ""}`}
                        className={`block truncate rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${STATUS_COLORS[j.status]}`}>
                        {j.title}
                      </Link>
                    </li>
                  ))}
                  {list.length > MAX_IN_CELL && <li className="px-1.5 text-[12px] text-muted">+ {list.length - MAX_IN_CELL} další</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobil: seznam po dnech */}
      <div className="space-y-3 md:hidden">
        {agenda.length === 0 || (agenda.length === 1 && onDay(agenda[0]!).length === 0) ? (
          <p className="card px-4 py-8 text-center text-muted">V tomto měsíci nemáte naplánovanou žádnou zakázku.</p>
        ) : (
          agenda.map((day) => (
            <section key={day}>
              <h2 className={`mb-1.5 text-[14px] font-semibold ${day === today ? "text-accent-ink" : "text-muted"}`}>
                {day === today ? "Dnes, " : ""}{dayLabel(day)}
              </h2>
              <ul className="card divide-y divide-line">
                {onDay(day).length === 0 && <li className="px-4 py-3 text-[14px] text-muted">Volno</li>}
                {onDay(day).map((j) => <JobLine key={j.id} job={j} />)}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {(["inquiry", "quote_sent", "approved", "in_progress", "done"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${STATUS_DOTS[s]}`} />{JOB_STATUSES[s]}</li>
          ))}
        </ul>
        {undated > 0 && (
          <Link className="text-accent-ink underline" href="/app/zakazky">Bez termínu: {undated} {undated === 1 ? "zakázka" : undated < 5 ? "zakázky" : "zakázek"}</Link>
        )}
      </div>
    </div>
  );
}

function JobLine({ job }: { job: CalendarJob }) {
  const short = (iso: string) => `${Number(iso.slice(8, 10))}.\u00a0${Number(iso.slice(5, 7))}.`;
  const range = job.dateTo && job.dateTo !== job.dateFrom ? `${short(job.dateFrom)}\u00a0–\u00a0${short(job.dateTo)}` : null;
  return (
    <li>
      <Link href={`/app/zakazky/${job.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-paper">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${STATUS_DOTS[job.status]}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{job.title}</p>
          <p className="text-[13px] text-muted">
            {[job.client, job.people.join(", ") || null, range].filter(Boolean).join(" · ") || JOB_STATUSES[job.status]}
          </p>
        </div>
      </Link>
    </li>
  );
}
