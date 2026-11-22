import type { Metadata } from "next";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { monthGrid, parseMonth, todayInPrague } from "@/lib/calendar";
import type { JobStatus } from "@/lib/labels";
import { CalendarView, type CalendarJob } from "./CalendarView";

export const metadata: Metadata = { title: "Kalendář" };

export default async function CalendarPage({ searchParams }: PageProps<"/app/kalendar">) {
  const company = await requireStaff();
  const { m } = await searchParams;
  const today = todayInPrague();
  const { year, month } = parseMonth(typeof m === "string" ? m : undefined, today);
  const { days } = monthGrid(year, month);
  const start = days[0]!;
  const end = days[days.length - 1]!;

  const supabase = await createClient();
  const [{ data }, { count: undated }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, status, date_from, date_to, clients(name), job_labor(employees(name))")
      .eq("company_id", company.id)
      .neq("status", "rejected")
      .not("date_from", "is", null)
      .lte("date_from", end)
      // Zakázka zasahuje do zobrazeného období: končí až po začátku, nebo nemá konec a začíná v něm.
      .or(`date_to.gte.${start},and(date_to.is.null,date_from.gte.${start})`)
      .order("date_from"),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .is("date_from", null)
      .not("status", "in", "(rejected,paid,invoiced,done)"),
  ]);

  type Row = {
    id: string; title: string; status: string; date_from: string; date_to: string | null;
    clients: { name: string } | null; job_labor: { employees: { name: string } | null }[];
  };
  const jobs: CalendarJob[] = ((data ?? []) as unknown as Row[]).map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status as JobStatus,
    dateFrom: j.date_from,
    dateTo: j.date_to,
    client: j.clients?.name ?? null,
    people: [...new Set(j.job_labor.map((l) => l.employees?.name).filter((n): n is string => !!n))],
  }));

  return <CalendarView year={year} month={month} today={today} jobs={jobs} undated={undated ?? 0} />;
}
