import type { Metadata } from "next";
import Link from "next/link";
import { formatPercent } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { loadJobProfits, totals, type JobProfit } from "@/lib/profit";
import { todayInPrague } from "@/lib/calendar";

export const metadata: Metadata = { title: "Ziskovost zakázek" };

const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const pct = (bp: number | null) => (bp === null ? "–" : formatPercent(bp));
/** Přehled v celých korunách (haléře jsou v detailu zakázky): 8400000 → „84 000 Kč“. */
const formatCzk = (h: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(h / 100))} Kč`;

export default async function ProfitPage({ searchParams }: PageProps<"/app/ziskovost">) {
  const company = await requireStaff();
  const thisYear = Number(todayInPrague().slice(0, 4));
  const r = Number((await searchParams).rok);
  const year = Number.isInteger(r) && r >= 2000 && r <= thisYear + 1 ? r : thisYear;
  const jobs = await loadJobProfits(company, `${year}-01-01`, `${year}-12-31`);
  const all = totals(jobs);
  const months = MONTHS.map((name, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { key, name, ...totals(jobs.filter((j) => j.month === key)) };
  }).filter((m) => m.count > 0);
  const maxAbs = Math.max(1, ...months.map((m) => Math.abs(m.profit)));
  const best = [...jobs].filter((j) => j.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const weakest = [...jobs].filter((j) => j.net > 0).sort((a, b) => (a.marginBp ?? 0) - (b.marginBp ?? 0)).slice(0, 5);
  const low = jobs.filter((j) => j.lowMargin).length;
  const missing = jobs.filter((j) => j.missingActuals > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-extrabold">Ziskovost zakázek</h1>
          <p className="text-[14px] text-muted">Odsouhlasené zakázky podle data dokončení, vše bez DPH.</p>
        </div>
        <nav className="flex items-center gap-1" aria-label="Rok">
          <Link href={`/app/ziskovost?rok=${year - 1}`} className="btn-ghost min-h-10 px-3" aria-label={`Rok ${year - 1}`}>←</Link>
          <span className="num min-w-16 text-center font-display text-[20px] font-extrabold">{year}</span>
          {year < thisYear && <Link href={`/app/ziskovost?rok=${year + 1}`} className="btn-ghost min-h-10 px-3" aria-label={`Rok ${year + 1}`}>→</Link>}
        </nav>
      </div>

      {jobs.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">V roce {year} zatím nemáte žádnou odsouhlasenou zakázku.</p>
          <p className="mt-1 text-[14px] text-muted">Zakázky ve stavu Schváleno až Zaplaceno se tu sečtou: obrat, náklady, zisk a marže.</p>
          <Link href="/app/zakazky" className="btn-ghost mt-4">Přejít na zakázky</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Obrat" value={formatCzk(all.net)} note={`${all.count} ${all.count === 1 ? "zakázka" : all.count < 5 ? "zakázky" : "zakázek"}`} />
            <Tile label="Náklady" value={formatCzk(all.costs)} note="materiál, lidé, výdaje" />
            <Tile label="Zisk" value={formatCzk(all.profit)} bad={all.profit < 0} note="obrat − náklady" />
            <Tile label="Průměrná marže" value={pct(all.marginBp)} bad={all.marginBp !== null && all.marginBp < Number(company.minMarginPct) * 100} note={`hlídáme pod ${company.minMarginPct.replace(".", ",")} %`} />
          </div>

          {(low > 0 || missing > 0) && (
            <ul className="space-y-1 rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn" role="status">
              {low > 0 && <li><strong>{low}</strong> {low === 1 ? "zakázka má" : "zakázky mají"} marži pod {company.minMarginPct.replace(".", ",")} %.</li>}
              {missing > 0 && <li>U <strong>{missing}</strong> dokončených zakázek chybí skutečné množství – počítáme s plánem. Doplňte ho v zakázce.</li>}
            </ul>
          )}

          <section className="card" aria-labelledby="mesice">
            <h2 id="mesice" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Po měsících</h2>
            <ul className="divide-y divide-line sm:hidden">
              {months.map((m) => (
                <li key={m.key} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold first-letter:uppercase">{m.name}<span className="ml-1 text-[12px] font-normal text-muted">({m.count})</span></span>
                    <span className={`num font-display text-[18px] font-extrabold ${m.profit < 0 ? "text-warn" : ""}`}>{formatCzk(m.profit)}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-sm bg-paper" aria-hidden="true">
                    <div className={`h-full rounded-sm ${m.profit < 0 ? "bg-warn" : "bg-ok"}`} style={{ width: `${Math.max(2, (Math.abs(m.profit) / maxAbs) * 100)}%` }} />
                  </div>
                  <p className="num mt-1.5 text-[13px] text-muted">obrat {formatCzk(m.net)} · náklady {formatCzk(m.costs)} · marže {pct(m.marginBp)}</p>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block">
              <table className="w-full text-[14px]">
                <thead className="text-left text-[12px] uppercase tracking-wide text-muted">
                  <tr><th className="px-4 py-2 font-semibold">Měsíc</th><th className="px-2 py-2 text-right font-semibold">Obrat</th><th className="px-2 py-2 text-right font-semibold">Náklady</th><th className="px-2 py-2 text-right font-semibold">Zisk</th><th className="w-[22%] px-2 py-2 font-semibold"><span className="sr-only">Graf zisku</span></th><th className="px-4 py-2 text-right font-semibold">Marže</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {months.map((m) => (
                    <tr key={m.key}>
                      <td className="px-4 py-2.5 font-semibold first-letter:uppercase">{m.name}<span className="ml-1 text-[12px] font-normal text-muted">({m.count})</span></td>
                      <td className="num px-2 py-2.5 text-right">{formatCzk(m.net)}</td>
                      <td className="num px-2 py-2.5 text-right text-muted">{formatCzk(m.costs)}</td>
                      <td className={`num px-2 py-2.5 text-right font-semibold ${m.profit < 0 ? "text-warn" : ""}`}>{formatCzk(m.profit)}</td>
                      <td className="px-2 py-2.5" aria-hidden="true">
                        <div className="h-2.5 rounded-sm bg-paper" title={`Zisk ${formatCzk(m.profit)}`}>
                          <div className={`h-full rounded-sm ${m.profit < 0 ? "bg-warn" : "bg-ok"}`} style={{ width: `${Math.max(2, (Math.abs(m.profit) / maxAbs) * 100)}%` }} />
                        </div>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{pct(m.marginBp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-4" aria-labelledby="naklady">
            <h2 id="naklady" className="font-display text-[17px] font-bold">Kam jdou náklady</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {([["Materiál", all.materials], ["Lidé", all.labor], ["Ostatní výdaje", all.expenses]] as const).map(([l, v]) => (
                <div key={l} className="flex items-baseline justify-between gap-3 rounded-xl bg-paper px-3 py-2.5 sm:block">
                  <dt className="text-[13px] text-muted">{l}</dt>
                  <dd className="num font-display text-[18px] font-extrabold sm:text-[20px]">{formatCzk(v)}</dd>
                  <dd className="hidden text-[13px] text-muted sm:block">{all.costs ? `${Math.round((v / all.costs) * 100)} % nákladů` : "–"}{all.net ? ` · ${Math.round((v / all.net) * 100)} % obratu` : ""}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {best.length > 0 && <JobList title="Nejvýnosnější zakázky" list={best} />}
            <JobList title="Nejnižší marže" list={weakest} />
          </div>
          <p className="text-[13px] text-muted">
            Stejné výpočty jako v souhrnu zakázky. U dokončených, vyfakturovaných a zaplacených zakázek bereme skutečné množství,
            kde je zapsané; u schválených a probíhajících plán.
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, note, bad }: { label: string; value: string; note: string; bad?: boolean }) {
  return (
    <div className="card min-w-0 px-4 py-3">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`num truncate font-display text-[20px] font-extrabold sm:text-[26px] ${bad ? "text-warn" : ""}`}>{value}</p>
      <p className="text-[12px] text-muted">{note}</p>
    </div>
  );
}

function JobList({ title, list }: { title: string; list: JobProfit[] }) {
  return (
    <section className="card min-w-0">
      <h2 className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">{title}</h2>
      <ul className="divide-y divide-line">
        {list.map((j) => (
          <li key={j.id}>
            <Link href={`/app/zakazky/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{j.title}</span>
                <span className="block truncate text-[13px] text-muted">{j.client ?? "Bez zákazníka"} · obrat {formatCzk(j.net)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`num block font-semibold ${j.profit < 0 ? "text-warn" : ""}`}>{formatCzk(j.profit)}</span>
                <span className={`num block text-[13px] ${j.lowMargin ? "font-semibold text-warn" : "text-muted"}`}>{pct(j.marginBp)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
