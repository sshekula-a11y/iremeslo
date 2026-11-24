import type { Metadata } from "next";
import Link from "next/link";
import { ACTION_LABELS, adminDate, requireAdmin } from "@/lib/admin";
import { czk } from "@/lib/format";

export const metadata: Metadata = { title: { absolute: "Přehled · Administrace iRemeslo" } };

interface Overview {
  companies: number; companies_7d: number; companies_30d: number; users: number; users_7d: number; users_active_30d: number;
  active_companies_30d: number; jobs: number; jobs_30d: number; quotes: number; invoices: number; invoices_30d: number;
  paying: number; read_only: number; mrr: string;
  weekly: { week: string; companies: number; users: number }[];
}
type FunnelRow = { inquiries: number; confirmed: number; contacts: number; signups: number; companies: number; activated: number; paying: number };
interface Funnel { weekly: (FunnelRow & { week: string })[]; total: FunnelRow }

const CUSTOMER_COLS: [keyof FunnelRow, string][] = [["inquiries", "Odeslané poptávky"], ["confirmed", "Potvrzené"], ["contacts", "Zobrazené kontakty"]];
const TRADE_COLS: [keyof FunnelRow, string][] = [["signups", "Registrace"], ["companies", "Firmy"], ["activated", "Aktivované"], ["paying", "Platící"]];

interface Action { at: string; action: string; company_id: string | null; company_name: string | null; target_email: string | null; detail: Record<string, unknown>; admin_email: string | null }

export default async function AdminOverview() {
  const { supabase } = await requireAdmin();
  const [{ data: o, error }, { data: actions }, { data: f }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_actions_recent", { p_limit: 12 }),
    supabase.rpc("admin_funnel"),
  ]);
  const funnel = f as Funnel | null;
  if (error || !o) throw new Error("Přehled se nepodařilo načíst.");
  const v = o as Overview;
  const max = Math.max(1, ...v.weekly.map((w) => Math.max(w.companies, w.users)));
  const activeShare = v.companies ? Math.round((v.active_companies_30d / v.companies) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[26px] font-extrabold">Přehled</h1>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Hlavní čísla">
        <Kpi label="Firmy" value={v.companies} sub={`+${v.companies_7d} za týden · +${v.companies_30d} za měsíc`} />
        <Kpi label="Uživatelé" value={v.users} sub={`+${v.users_7d} za týden · ${v.users_active_30d} přihlášených za měsíc`} />
        <Kpi label="Aktivní firmy (30 dní)" value={v.active_companies_30d} sub={`${activeShare} % všech firem`} />
        <Kpi label="Měsíční příjem (MRR)" value={czk(v.mrr)} sub={`${v.paying} platících · ${v.read_only} jen pro čtení`} href="/ssh/platby" />
      </section>

      <section className="grid grid-cols-3 gap-3" aria-label="Používání">
        <Kpi label="Zakázky" value={v.jobs} sub={`+${v.jobs_30d} za měsíc`} small />
        <Kpi label="Nabídky" value={v.quotes} small />
        <Kpi label="Faktury" value={v.invoices} sub={`+${v.invoices_30d} za měsíc`} small />
      </section>

      <section className="card p-4" aria-labelledby="reg">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reg" className="font-display text-[17px] font-bold">Registrace po týdnech</h2>
          <p className="flex gap-4 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ink" />Firmy</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" />Uživatelé</span>
          </p>
        </div>
        <div className="flex h-40 items-end gap-1.5 sm:gap-3">
          {v.weekly.map((w, i) => (
            <div key={w.week} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Týden od ${adminDate(w.week)}: ${w.companies} firem, ${w.users} uživatelů`}>
              <div className="flex flex-1 items-end justify-center gap-0.5">
                <div className="w-1/2 max-w-4 rounded-t bg-ink" style={{ height: `${(w.companies / max) * 100}%`, minHeight: w.companies ? 3 : 0 }} />
                <div className="w-1/2 max-w-4 rounded-t bg-accent" style={{ height: `${(w.users / max) * 100}%`, minHeight: w.users ? 3 : 0 }} />
              </div>
              {/* na telefonu jen každý třetí popisek, jinak se nevejdou */}
              <p className={`num mt-1 whitespace-nowrap text-center text-[11px] text-muted ${i % 3 === 2 ? "" : "invisible sm:visible"}`}>{adminDate(w.week).replace(/ \d{4}$/, "")}</p>
            </div>
          ))}
        </div>
      </section>

      {funnel && (
        <section className="card overflow-hidden" aria-labelledby="trychtyr">
          <div className="border-b border-line px-4 py-3">
            <h2 id="trychtyr" className="font-display text-[17px] font-bold">Konverze po týdnech</h2>
            <p className="text-[13px] text-muted">
              Přímo z databáze, tedy úplně (Google Analytics vidí jen návštěvníky se souhlasem). Ukázkové poptávky se nepočítají.
              Aktivovaná firma = první vystavená nabídka nebo faktura; platící = první zaznamenaná platba.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-[14px]">
              <thead className="bg-paper text-left text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Týden od</th>
                  {CUSTOMER_COLS.map(([k, l]) => <th key={k} className="px-3 py-2 text-right font-medium">{l}</th>)}
                  {TRADE_COLS.map(([k, l], i) => <th key={k} className={`px-3 py-2 text-right font-medium ${i === 0 ? "border-l border-line" : ""}`}>{l}</th>)}
                </tr>
              </thead>
              <tbody className="num divide-y divide-line">
                {[...funnel.weekly].reverse().map((w) => (
                  <tr key={w.week}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted">{adminDate(w.week)}</td>
                    {CUSTOMER_COLS.map(([k]) => <td key={k} className={`px-3 py-1.5 text-right ${w[k] ? "font-semibold" : "text-muted"}`}>{w[k]}</td>)}
                    {TRADE_COLS.map(([k], i) => <td key={k} className={`px-3 py-1.5 text-right ${i === 0 ? "border-l border-line" : ""} ${w[k] ? "font-semibold" : "text-muted"}`}>{w[k]}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot className="num border-t-2 border-line bg-paper font-bold">
                <tr>
                  <td className="px-3 py-2">Celkem</td>
                  {CUSTOMER_COLS.map(([k]) => <td key={k} className="px-3 py-2 text-right">{funnel.total[k]}</td>)}
                  {TRADE_COLS.map(([k], i) => <td key={k} className={`px-3 py-2 text-right ${i === 0 ? "border-l border-line" : ""}`}>{funnel.total[k]}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="zasahy">
        <h2 id="zasahy" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Poslední zásahy</h2>
        {actions && actions.length > 0 ? (
          <ul className="divide-y divide-line">
            {(actions as Action[]).map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-[14px]">
                <span>
                  <span className="font-semibold">{ACTION_LABELS[a.action] ?? a.action}</span>
                  {a.company_id && <> · <Link className="text-accent-ink hover:underline" href={`/ssh/firmy/${a.company_id}`}>{a.company_name}</Link></>}
                  {a.target_email && <> · {a.target_email}</>}
                  {typeof a.detail?.reason === "string" && <span className="text-muted"> – {a.detail.reason}</span>}
                </span>
                <span className="text-[13px] text-muted">{adminDate(a.at, true)} · {a.admin_email}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-4 py-6 text-center text-muted">Zatím žádné zásahy.</p>}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, href, small }: { label: string; value: number | string; sub?: string; href?: string; small?: boolean }) {
  const body = (
    <>
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`num font-display font-extrabold ${small ? "text-[20px] sm:text-[22px]" : "text-[22px] sm:text-[28px]"}`}>{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </>
  );
  return href ? <Link href={href} className="card block px-4 py-3 hover:border-ink/30">{body}</Link> : <div className="card px-4 py-3">{body}</div>;
}
