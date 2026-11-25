import type { Metadata } from "next";
import Link from "next/link";
import { annualize, compareRegimes, taxParams, VAT_IMMEDIATE, VAT_THRESHOLD, type RegimeResult } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { czk, formatDate } from "@/lib/format";
import { todayInPrague } from "@/lib/calendar";
import { CATEGORY_LABEL } from "@/lib/expenses";
import { yearData } from "@/lib/tax/data";
import { upcomingDeadlines } from "@/lib/tax/deadlines";
import { saveTaxProfile } from "./actions";

export const metadata: Metadata = { title: "Daně a odvody" };

const REGIME_LABEL: Record<RegimeResult["regime"], string> = {
  actual: "Skutečné výdaje (daňová evidence)",
  flat_expenses: "Výdajový paušál",
  flat_tax: "Paušální daň",
};
const MONTHS = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];
const kc0 = (n: number) => czk(Math.round(n));

export default async function TaxPage({ searchParams }: PageProps<"/app/ucetni">) {
  const company = await requireStaff();
  const today = todayInPrague();
  const thisYear = Number(today.slice(0, 4));
  const rok = Number((await searchParams).rok);
  const year = Number.isInteger(rok) && rok >= 2024 && rok <= thisYear ? rok : thisYear;

  const supabase = await createClient();
  const { data: prof } = await supabase.from("tax_profiles").select("legal_form, flat_rate, regime").eq("company_id", company.id).maybeSingle();
  const guessPo = /s\.\s?r\.\s?o|spol\.|a\.\s?s\./i.test(company.name);
  const profile = {
    legalForm: (prof?.legal_form ?? (guessPo ? "po" : "osvc")) as "osvc" | "po",
    flatRate: (prof?.flat_rate ?? 80) as 80 | 60 | 40,
    regime: (prof?.regime ?? "flat_expenses") as "actual" | "flat_expenses" | "flat_tax",
  };
  const d = await yearData(company.id, year, company.vatPayer);
  const current = year === thisYear;
  const incomeYear = current ? annualize(d.income, year, today) : d.income;
  const expensesYear = current ? annualize(d.expenses, year, today) : d.expenses;
  const regimes = profile.legalForm === "osvc"
    ? compareRegimes({ year, income: incomeYear, actualExpenses: expensesYear, flatRate: profile.flatRate, vatPayer: company.vatPayer })
    : null;
  // „Nejvýhodnější“ jen když je režim opravdu levnější než všechny ostatní (při shodě nic nedoporučujeme).
  const minTotal = regimes ? Math.min(...regimes.map((r) => r.total)) : 0;
  const cheapest = regimes && regimes.filter((r) => r.total === minTotal).length === 1 ? regimes.find((r) => r.total === minTotal)! : null;
  const params = taxParams(year);
  const deadlines = upcomingDeadlines({ legalForm: profile.legalForm, regime: profile.regime, vatPayer: company.vatPayer }, today, 75);
  const vatShare = Math.min(1, d.turnover / VAT_THRESHOLD);
  const maxMonth = Math.max(1, ...d.monthly.map((m) => Math.max(m.income, m.expenses)));
  const lastYear = thisYear - 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold">Daně a odvody</h1>
          <p className="text-[14px] text-muted">Příjmy, výdaje, odhad daně a pojistného, hlídání DPH a termíny – z vašich faktur a výdajů.</p>
        </div>
        <nav className="flex gap-1.5" aria-label="Rok">
          {[thisYear, thisYear - 1].map((y) => (
            <Link key={y} href={`/app/ucetni${y === thisYear ? "" : `?rok=${y}`}`} aria-current={y === year ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[14px] font-semibold ring-1 ${y === year ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:bg-paper"}`}>{y}</Link>
          ))}
        </nav>
      </div>

      {/* Daňový profil */}
      <details className="card group" open={!prof}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span>
            <span className="font-semibold">Daňový profil: </span>
            <span className="text-muted">
              {profile.legalForm === "po" ? "právnická osoba (s.r.o.)" : `OSVČ · ${REGIME_LABEL[profile.regime].toLowerCase()}${profile.regime !== "actual" ? ` · paušál ${profile.flatRate} %` : ""}`}
              {company.vatPayer ? " · plátce DPH" : " · neplátce DPH"}
            </span>
          </span>
          <span className="text-[14px] font-semibold text-accent-ink">{prof ? "Změnit" : "Nastavte prosím"}</span>
        </summary>
        <form action={saveTaxProfile} className="grid gap-3 border-t border-line px-4 py-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="legal_form">Kdo podniká</label>
            <select id="legal_form" name="legal_form" className="field" defaultValue={profile.legalForm}>
              <option value="osvc">OSVČ (živnostník)</option>
              <option value="po">Firma (s.r.o., a.s.)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="regime">Jak danit (OSVČ)</label>
            <select id="regime" name="regime" className="field" defaultValue={profile.regime}>
              <option value="flat_expenses">Výdajový paušál</option>
              <option value="actual">Skutečné výdaje</option>
              <option value="flat_tax">Paušální daň</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="flat_rate">Výdajový paušál</label>
            <select id="flat_rate" name="flat_rate" className="field" defaultValue={String(profile.flatRate)}>
              <option value="80">80 % – řemeslné živnosti</option>
              <option value="60">60 % – ostatní živnosti</option>
              <option value="40">40 % – svobodná povolání</option>
            </select>
          </div>
          <p className="text-[13px] text-muted sm:col-span-2">Plátcovství DPH se nastavuje v <Link href="/app/nastaveni" className="underline">údajích firmy</Link>.</p>
          <div className="sm:text-right"><button className="btn-primary">Uložit profil</button></div>
        </form>
      </details>

      {/* Souhrn */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Souhrn roku">
        <div className="card p-4">
          <p className="text-[13px] text-muted">Příjmy {year}{company.vatPayer ? " (bez DPH)" : ""}</p>
          <p className="num font-display text-[24px] font-extrabold">{czk(d.income)}</p>
          {current && <p className="text-[13px] text-muted">odhad na celý rok {kc0(incomeYear)}</p>}
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">Výdaje {year}</p>
          <p className="num font-display text-[24px] font-extrabold">{czk(d.expenses)}</p>
          <Link href="/app/vydaje/novy" className="text-[13px] font-semibold text-accent-ink underline">+ přidat účtenku</Link>
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">Rozdíl (zisk podle skutečných výdajů)</p>
          <p className={`num font-display text-[24px] font-extrabold ${d.income - d.expenses < 0 ? "text-warn" : ""}`}>{czk(d.income - d.expenses)}</p>
          {d.incomeAssumed > 0 && <p className="text-[13px] text-muted">z toho převzaté faktury bez data úhrady {kc0(d.incomeAssumed)}</p>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-5">
          {/* Odhad daně a pojistného */}
          {regimes ? (
            <section className="card overflow-hidden" aria-labelledby="odhad">
              <div className="border-b border-line px-4 py-3">
                <h2 id="odhad" className="font-semibold">Odhad daně a pojistného {current ? "za celý rok" : `za rok ${year}`}</h2>
                <p className="text-[13px] text-muted">{current ? "Podle dosavadních příjmů a výdajů přepočtených na celý rok. " : ""}OSVČ s hlavní činností, sleva na poplatníka, bez dalších slev a odpočtů.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-[14px]">
                  <thead className="bg-paper text-left text-[12px] uppercase text-muted">
                    <tr><th className="px-4 py-2">Režim</th><th className="px-2 text-right">Daň</th><th className="px-2 text-right">Sociální</th><th className="px-2 text-right">Zdravotní</th><th className="px-4 text-right">Celkem</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {regimes.map((r) => (
                      <tr key={r.regime} className={r === cheapest ? "bg-ok-soft/60" : ""}>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold">{REGIME_LABEL[r.regime]}{r.regime === "flat_expenses" ? ` ${profile.flatRate} %` : r.band ? ` – ${r.band}. pásmo` : ""}</span>
                          {r.regime === profile.regime && <span className="ml-1.5 rounded-full bg-paper px-1.5 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line">váš režim</span>}
                          {r === cheapest && <span className="ml-1.5 rounded-full bg-ok px-1.5 py-0.5 text-[11px] font-semibold text-white">nejvýhodnější</span>}
                          {r.regime !== "flat_tax" && <span className="block text-[12px] text-muted">výdaje {kc0(r.expenses)} · základ daně {kc0(r.taxBase)}</span>}
                        </td>
                        {r.regime === "flat_tax"
                          ? <td colSpan={3} className="px-2 text-right text-[13px] text-muted">daň + sociální + zdravotní v jedné platbě</td>
                          : <><td className="num px-2 text-right">{kc0(r.tax)}</td><td className="num px-2 text-right">{kc0(r.social)}</td><td className="num px-2 text-right">{kc0(r.health)}</td></>}
                        <td className="num px-4 text-right font-semibold">{kc0(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-line px-4 py-3 text-[12px] text-muted">
                Orientační odhad podle parametrů roku {year}{params ? ` (průměrná mzda ${czk(params.avgWage)}, min. zálohy ${czk(params.socialMinMonthly)} + ${czk(params.healthMinMonthly)} měsíčně)` : ""}. Nejde o daňové poradenství – před rozhodnutím o režimu se poraďte s účetní nebo daňovým poradcem.
                {params?.note ? ` ${params.note}` : ""}
              </p>
            </section>
          ) : profile.legalForm === "po" ? (
            <section className="card p-4" aria-labelledby="odhad-po">
              <h2 id="odhad-po" className="font-semibold">Daň z příjmů právnických osob</h2>
              <p className="mt-1 text-[14px]">Sazba 21 % ze zisku. Odhad ze skutečných výdajů: <span className="num font-semibold">{kc0(Math.max(0, incomeYear - expensesYear) * 0.21)}</span>{current ? " za celý rok" : ""}.</p>
              <p className="mt-1 text-[12px] text-muted">Firma vede účetnictví – skutečný zisk určí účetní závěrka (odpisy, rezervy, nedaňové náklady).</p>
            </section>
          ) : (
            <section className="card p-4 text-[14px] text-muted">Parametry pro rok {year} zatím nemáme.</section>
          )}

          {/* Měsíce */}
          <section className="card p-4" aria-labelledby="mesice">
            <h2 id="mesice" className="font-semibold">Příjmy a výdaje po měsících</h2>
            <div className="mt-3 grid grid-cols-12 items-end gap-1" style={{ height: 120 }} role="img" aria-label="Graf příjmů a výdajů po měsících">
              {d.monthly.map((m, i) => (
                <div key={i} className="flex h-full items-end justify-center gap-0.5" title={`${MONTHS[i]}: příjmy ${kc0(m.income)}, výdaje ${kc0(m.expenses)}`}>
                  <span className="w-2 rounded-t bg-ok" style={{ height: `${(m.income / maxMonth) * 100}%` }} />
                  <span className="w-2 rounded-t bg-accent" style={{ height: `${(m.expenses / maxMonth) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-12 gap-1 text-center text-[11px] text-muted">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
            <p className="mt-2 flex gap-4 text-[12px] text-muted"><span><span className="mr-1 inline-block size-2.5 rounded-sm bg-ok" />příjmy</span><span><span className="mr-1 inline-block size-2.5 rounded-sm bg-accent" />výdaje</span></p>
          </section>

          {/* Podklady pro přiznání */}
          <section className="card p-4" aria-labelledby="podklady">
            <h2 id="podklady" className="font-semibold">Podklady pro přiznání za rok {year}</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-muted">Příjmy (ř. 101 přílohy č. 1)</dt><dd className="num font-semibold">{kc0(d.income)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Skutečné výdaje (ř. 102)</dt><dd className="num font-semibold">{kc0(d.expenses)}</dd></div>
              {Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <div key={c} className="flex justify-between gap-3 pl-3 text-[13px]"><dt className="text-muted">{CATEGORY_LABEL[c] ?? c}</dt><dd className="num">{kc0(v)}</dd></div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/app/ucetni/evidence?rok=${year}`} className="btn-dark min-h-10 px-3 text-[14px]">Stáhnout daňovou evidenci (Excel)</a>
              <Link href="/app/faktury/export" className="btn-ghost min-h-10 px-3 text-[14px]">Faktury pro účetní (ZIP)</Link>
            </div>
            <p className="mt-2 text-[12px] text-muted">Odpisy majetku, slevy na děti a manžela a nezdanitelné částky (penzijní spoření, hypotéka, dary) doplňte v přiznání.</p>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          {/* DPH */}
          {!company.vatPayer && (
            <section className={`card p-4 ${d.turnover > VAT_THRESHOLD ? "ring-2 ring-warn" : ""}`} aria-labelledby="dph">
              <h2 id="dph" className="font-semibold">Hlídání obratu pro DPH</h2>
              <p className="mt-1 text-[14px]">Obrat {year}: <span className="num font-semibold">{kc0(d.turnover)}</span> z limitu <span className="num">{kc0(VAT_THRESHOLD)}</span></p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-paper ring-1 ring-line" role="progressbar" aria-valuenow={Math.round(vatShare * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Obrat vůči limitu DPH">
                <div className={`h-full ${vatShare >= 1 ? "bg-warn" : vatShare >= 0.8 ? "bg-accent" : "bg-ok"}`} style={{ width: `${vatShare * 100}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-muted">
                {d.turnover > VAT_IMMEDIATE
                  ? <strong className="text-warn">Obrat překročil {kc0(VAT_IMMEDIATE)} – plátcem DPH jste od následujícího dne. Ihned to řešte s účetní a finančním úřadem.</strong>
                  : d.turnover > VAT_THRESHOLD
                    ? <strong className="text-warn">Limit 2 mil. Kč je překročený – od 1. ledna příštího roku budete plátcem DPH. Přihlášku podejte do 10 pracovních dnů po skončení měsíce, kdy jste limit překročili.</strong>
                    : vatShare >= 0.8
                      ? "Blížíte se limitu. Plátcem DPH se stanete od 1. ledna příštího roku po překročení 2 mil. Kč, nad 2 536 500 Kč hned."
                      : "Do limitu máte rezervu. Počítáme vystavené faktury (i převzaté z jiného programu)."}
              </p>
            </section>
          )}

          {/* Termíny */}
          <section className="card" aria-labelledby="terminy">
            <h2 id="terminy" className="border-b border-line px-4 py-3 font-semibold">Nejbližší termíny</h2>
            {deadlines.length === 0 ? <p className="px-4 py-3 text-[14px] text-muted">V příštích týdnech žádné.</p> : (
              <ul className="divide-y divide-line">
                {deadlines.map((t) => (
                  <li key={t.date + t.title} className="flex gap-3 px-4 py-2.5">
                    <span className={`num w-16 shrink-0 text-[13px] font-semibold ${t.date <= addDaysIso(today, 7) ? "text-warn" : "text-ink"}`}>{formatDate(t.date).replace(/ \d{4}$/, "")}</span>
                    <span className="min-w-0 text-[14px]"><span className="block font-semibold leading-snug">{t.title}</span><span className="block text-[13px] text-muted">{t.detail}</span></span>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">Termíny podle vašeho profilu, posunuté na pracovní den. Zálohy na pojištění: zdravotní do 8., sociální do 20. dne následujícího měsíce.</p>
          </section>

          {current && year === thisYear && thisYear > 2024 && (
            <p className="text-[13px] text-muted">Podklady za minulý rok: <Link href={`/app/ucetni?rok=${lastYear}`} className="font-semibold text-accent-ink underline">rok {lastYear}</Link></p>
          )}
        </div>
      </div>
    </div>
  );
}

function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
