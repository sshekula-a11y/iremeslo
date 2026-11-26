import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { czk, formatDate } from "@/lib/format";
import { todayInPrague } from "@/lib/calendar";
import { CATEGORY_LABEL } from "@/lib/expenses";
import { FileLink } from "./FileLink";

export const metadata: Metadata = { title: "Výdaje" };

export default async function ExpensesPage({ searchParams }: PageProps<"/app/vydaje">) {
  const company = await requireStaff();
  const thisYear = Number(todayInPrague().slice(0, 4));
  const rok = Number((await searchParams).rok);
  const year = Number.isInteger(rok) && rok >= 2000 && rok <= thisYear + 1 ? rok : thisYear;
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("id, supplier_name, issue_date, total, currency, category, description, file_path, source, jobs(number)")
    .eq("company_id", company.id)
    .gte("issue_date", `${year}-01-01`).lte("issue_date", `${year}-12-31`)
    .order("issue_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as unknown as { id: string; supplier_name: string; issue_date: string; total: string; currency: string; category: string; description: string | null; file_path: string | null; source: string; jobs: { number: string | null } | null }[];
  const czkRows = rows.filter((r) => r.currency === "CZK");
  const sum = czkRows.reduce((s, r) => s + Number(r.total), 0);
  const byCat = new Map<string, number>();
  for (const r of czkRows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.total));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold">Výdaje</h1>
          <p className="text-[14px] text-muted">Účtenky a přijaté faktury. Vyfoťte účtenku nebo nahrajte PDF – údaje se přečtou samy.</p>
        </div>
        <Link href="/app/vydaje/novy" className="btn-primary">Přidat výdaj</Link>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Rok">
        {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
          <Link key={y} href={`/app/vydaje?rok=${y}`} aria-current={y === year ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-[14px] font-semibold ring-1 ${y === year ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-line hover:bg-paper"}`}>{y}</Link>
        ))}
      </nav>

      <section className="card grid gap-3 p-4 sm:grid-cols-[auto_1fr]" aria-label="Souhrn">
        <div>
          <p className="text-[13px] text-muted">Výdaje {year}</p>
          <p className="num font-display text-[26px] font-extrabold">{czk(sum)}</p>
          <p className="text-[13px] text-muted">{rows.length} {rows.length === 1 ? "doklad" : rows.length >= 2 && rows.length <= 4 ? "doklady" : "dokladů"}</p>
        </div>
        {cats.length > 0 && (
          <ul className="grid gap-1 text-[14px] sm:grid-cols-2 sm:gap-x-6">
            {cats.map(([c, v]) => <li key={c} className="flex justify-between gap-3"><span className="text-muted">{CATEGORY_LABEL[c] ?? c}</span><span className="num font-semibold">{czk(v)}</span></li>)}
          </ul>
        )}
      </section>

      {rows.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Za rok {year} zatím nemáte žádné výdaje.</p>
          <p className="mt-1 text-[14px] text-muted">Vyfoťte první účtenku – AI z ní přečte dodavatele, datum i částku.</p>
          <Link href="/app/vydaje/novy" className="btn-primary mt-4 inline-flex">Přidat výdaj</Link>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
              <Link href={`/app/vydaje/${r.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate font-semibold">{r.supplier_name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {formatDate(r.issue_date)} · {CATEGORY_LABEL[r.category] ?? r.category}{r.jobs?.number ? ` · ${r.jobs.number}` : ""}{r.description ? ` · ${r.description}` : ""}
                </span>
              </Link>
              <span className="flex items-center gap-3">
                {r.file_path && <FileLink id={r.id} />}
                <span className="num font-semibold">{r.currency === "CZK" ? czk(r.total) : `${Number(r.total).toFixed(2).replace(".", ",")} ${r.currency}`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
