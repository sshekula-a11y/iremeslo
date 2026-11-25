import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { czk, formatDate } from "@/lib/format";
import { todayInPrague } from "@/lib/calendar";
import { DOC_STATUS_LABELS, DOC_TYPE_LABELS } from "@/lib/documents/load";

export const metadata: Metadata = { title: "Doklady a listiny" };

/** Filtry podle druhu dokladu – jako v účetních programech (vydané faktury, nabídky, smlouvy…). */
const FILTERS: { id: string; label: string; types: string[] }[] = [
  { id: "vse", label: "Vše", types: [] },
  { id: "faktury", label: "Faktury a zálohy", types: ["invoice", "invoice_non_payer", "advance", "ddpp", "credit_note"] },
  { id: "nabidky", label: "Nabídky", types: ["quote"] },
  { id: "smlouvy", label: "Smlouvy a dodatky", types: ["contract", "amendment"] },
  { id: "predani", label: "Protokoly a dodací listy", types: ["handover", "delivery"] },
  { id: "upominky", label: "Upomínky", types: ["reminder"] },
  { id: "reklamace", label: "Reklamace", types: ["claim"] },
  { id: "pokladna", label: "Pokladní doklady", types: ["cash_in", "cash_out"] },
];
const MONEY = new Set(["invoice", "invoice_non_payer", "advance", "ddpp", "credit_note", "quote", "cash_in", "cash_out"]);

const clean = (s: string) => s.replace(/[%_,()"\\*]/g, " ").trim().slice(0, 60);

export default async function DocumentsPage({ searchParams }: PageProps<"/app/doklady">) {
  const company = await requireStaff();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === sp.druh) ?? FILTERS[0];
  const thisYear = Number(todayInPrague().slice(0, 4));
  const rok = Number(sp.rok);
  const year = Number.isInteger(rok) && rok >= 2000 && rok <= thisYear ? rok : thisYear;
  const q = clean(typeof sp.q === "string" ? sp.q : "");

  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("id, type, number, status, issue_date, total_due, customer:snapshot->customer->>name, counterparty:snapshot->counterparty->>name, level:snapshot->>level")
    .eq("company_id", company.id)
    .not("number", "is", null)
    .gte("issue_date", `${year}-01-01`).lte("issue_date", `${year}-12-31`)
    .order("issue_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(500);
  if (filter.types.length) query = query.in("type", filter.types);
  if (q) query = query.or(`number.ilike.*${q}*,snapshot->customer->>name.ilike.*${q}*,snapshot->counterparty->>name.ilike.*${q}*`);
  const { data } = await query;
  const rows = ((data ?? []) as unknown as { id: string; type: string; number: string; status: string; issue_date: string; total_due: string; customer: string | null; counterparty: string | null; level: string | null }[])
    .map((r) => ({ ...r, name: r.customer ?? r.counterparty }));
  const href = (o: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const v = { druh: filter.id, rok: year, q, ...o };
    if (v.druh && v.druh !== "vse") p.set("druh", String(v.druh));
    if (v.rok && v.rok !== thisYear) p.set("rok", String(v.rok));
    if (v.q) p.set("q", String(v.q));
    const s = p.toString();
    return `/app/doklady${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold">Doklady a listiny</h1>
          <p className="text-[14px] text-muted">Faktury, nabídky, smlouvy, protokoly, upomínky i pokladní doklady na jednom místě.</p>
        </div>
        <Link href="/app/faktury/rychla" className="btn-primary">+ Faktura</Link>
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search" action="/app/doklady">
        {filter.id !== "vse" && <input type="hidden" name="druh" value={filter.id} />}
        {year !== thisYear && <input type="hidden" name="rok" value={year} />}
        <label className="sr-only" htmlFor="doc-q">Hledat v dokladech</label>
        <input id="doc-q" name="q" type="search" defaultValue={q} placeholder="Číslo dokladu nebo zákazník" className="field h-10 max-w-xs flex-1 text-[14px]" />
        <button className="btn-ghost min-h-10 px-3 text-[14px]">Hledat</button>
        <span className="ml-auto flex gap-1.5" aria-label="Rok">
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
            <Link key={y} href={href({ rok: y })} aria-current={y === year ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${y === year ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:bg-paper"}`}>{y}</Link>
          ))}
        </span>
      </form>

      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Druh dokladu">
        <ul className="flex w-max gap-1.5">
          {FILTERS.map((f) => (
            <li key={f.id}>
              <Link href={href({ druh: f.id })} aria-current={f.id === filter.id ? "page" : undefined}
                className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${f.id === filter.id ? "bg-accent-soft text-ink ring-accent/40" : "bg-white text-ink/80 ring-line hover:bg-paper"}`}>{f.label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <div className="card p-6 text-center text-muted">
          {q ? <>Nic jsme nenašli pro „{q}“.</> : <>Za rok {year} tu zatím nic není.</>}
          <p className="mt-2 text-[14px]">Smlouvy, protokoly a dodací listy vystavíte u zakázky, upomínky a reklamace u faktury.</p>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/app/doklady/${r.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {r.type === "reminder" && r.level === "final" ? "Předžalobní výzva" : DOC_TYPE_LABELS[r.type] ?? r.type} <span className="num">{r.number}</span>
                  </span>
                  <span className="block truncate text-[13px] text-muted">{formatDate(r.issue_date)}{r.name ? ` · ${r.name}` : ""}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[12px] text-muted ring-1 ring-line">{DOC_STATUS_LABELS[r.status] ?? r.status}</span>
                  {MONEY.has(r.type) && <span className="num w-28 text-right font-semibold">{czk(r.total_due)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
