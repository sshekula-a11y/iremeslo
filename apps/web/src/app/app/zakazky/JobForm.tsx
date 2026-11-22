"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_UNITS, formatCzk, formatPercent, lineTotal, salePriceFromMarkup } from "@iremeslo/core";
import { JOB_STATUSES, VAT_MODE_LABELS, type JobStatus } from "@/lib/labels";
import { parseInput, toInput } from "@/lib/money";
import { saveJob } from "./actions";
import { safeSummary } from "./summary";
import type { ClientOption, EmployeeOption, ExpenseRow, JobDraft, LaborRow, MaterialRow, WorkRow } from "./types";

let seq = 0;
const key = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

const emptyWork = (): WorkRow => ({ key: key(), description: "", qty: "", unit: "m²", unitPrice: "" });
const emptyMaterial = (): MaterialRow => ({ key: key(), description: "", qty: "", qtyActual: "", unit: "ks", purchasePrice: "", salePrice: "", billable: true });
const emptyExpense = (): ExpenseRow => ({ key: key(), description: "", qty: "1", qtyActual: "", unitPrice: "" });

type SectionKey = "work" | "materials" | "labor" | "expenses";

export function JobForm({
  initial,
  clients,
  employees,
  markupPct,
  minMarginPct,
}: {
  initial: JobDraft;
  clients: ClientOption[];
  employees: EmployeeOption[];
  markupPct: string;
  minMarginPct: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<JobDraft>(initial);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { summary, error: calcError } = useMemo(() => safeSummary(d, minMarginPct), [d, minMarginPct]);

  const set = <K extends keyof JobDraft>(k: K, v: JobDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  function updateRow<S extends SectionKey>(section: S, rowKey: string, patch: Partial<JobDraft[S][number]>) {
    setD((x) => ({ ...x, [section]: (x[section] as JobDraft[S]).map((r) => (r.key === rowKey ? { ...r, ...patch } : r)) }));
  }
  function addRow<S extends SectionKey>(section: S, row: JobDraft[S][number]) {
    setD((x) => ({ ...x, [section]: [...(x[section] as JobDraft[S]), row] }));
  }
  function removeRow(section: SectionKey, rowKey: string) {
    setD((x) => ({ ...x, [section]: (x[section] as { key: string }[]).filter((r) => r.key !== rowKey) }));
  }
  function copyRow(section: SectionKey, rowKey: string) {
    setD((x) => {
      const rows = x[section] as { key: string }[];
      const i = rows.findIndex((r) => r.key === rowKey);
      if (i < 0) return x;
      const copy = { ...rows[i]!, key: key() };
      return { ...x, [section]: [...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)] };
    });
  }
  function moveRow(section: SectionKey, rowKey: string, dir: -1 | 1) {
    setD((x) => {
      const rows = [...(x[section] as { key: string }[])];
      const i = rows.findIndex((r) => r.key === rowKey);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rows.length) return x;
      [rows[i], rows[j]] = [rows[j]!, rows[i]!];
      return { ...x, [section]: rows };
    });
  }

  function newLabor(): LaborRow {
    const e = employees[0];
    return { key: key(), employeeId: e?.id ?? "", qty: "", qtyActual: "", unit: "den", rate: e ? toInput(parseInput(e.rateDay)) : "" };
  }

  function onSave() {
    setMessage(null);
    startSaving(async () => {
      const res = await saveJob(d);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: "Uloženo" });
      if (!d.id) router.replace(`/app/zakazky/${res.id}`);
      else router.refresh();
    });
  }

  const rowTools = (section: SectionKey, rowKey: string, i: number, count: number) => (
    <div className="flex items-center gap-1">
      <IconBtn label="Posunout nahoru" onClick={() => moveRow(section, rowKey, -1)} disabled={i === 0}>↑</IconBtn>
      <IconBtn label="Posunout dolů" onClick={() => moveRow(section, rowKey, 1)} disabled={i === count - 1}>↓</IconBtn>
      <IconBtn label="Kopírovat řádek" onClick={() => copyRow(section, rowKey)}>⧉</IconBtn>
      <IconBtn label="Odebrat řádek" onClick={() => removeRow(section, rowKey)} danger>✕</IconBtn>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        {/* Hlavička */}
        <section className="card space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="num text-[13px] font-semibold text-muted">{d.number ?? "Nová zakázka"}</p>
            <select className="field w-auto py-1.5 text-[14px]" aria-label="Stav zakázky" value={d.status} onChange={(e) => set("status", e.target.value as JobStatus)}>
              {Object.entries(JOB_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="title">Název zakázky</label>
            <input className="field text-[17px] font-semibold" id="title" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="např. Nátěr střechy – Novák" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="client">Klient</label>
              <select className="field" id="client" value={d.clientId} onChange={(e) => set("clientId", e.target.value)}>
                <option value="">+ Nový klient</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!d.clientId && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="nc-name">Jméno klienta</label>
                  <input className="field" id="nc-name" value={d.newClientName} onChange={(e) => set("newClientName", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="nc-phone">Telefon</label>
                  <input className="field" id="nc-phone" type="tel" value={d.newClientPhone} onChange={(e) => set("newClientPhone", e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="site">Místo realizace</label>
            <div className="flex gap-2">
              <input className="field" id="site" value={d.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} placeholder="Ulice, obec" />
              {d.siteAddress.trim() && (
                <a className="btn-ghost shrink-0" target="_blank" rel="noreferrer" href={`https://mapy.cz/zakladni?q=${encodeURIComponent(d.siteAddress)}`}>Mapa</a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="from">Termín od</label>
              <input className="field" id="from" type="date" value={d.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="to">Termín do</label>
              <input className="field" id="to" type="date" min={d.dateFrom || undefined} value={d.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
            </div>
          </div>
          {d.dateFrom && d.dateTo && d.dateTo < d.dateFrom && <p className="text-[13px] text-warn">Termín „do“ je před „od“.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="vatmode">DPH</label>
              <select className="field" id="vatmode" value={d.vatMode} onChange={(e) => set("vatMode", e.target.value as JobDraft["vatMode"])}>
                {Object.entries(VAT_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {d.vatMode === "standard" && (
              <div>
                <span className="label">Sazba DPH</span>
                <div className="grid grid-cols-2 gap-2">
                  {([21, 12] as const).map((r) => (
                    <button key={r} type="button" onClick={() => set("vatRate", r)}
                      className={`btn ${d.vatRate === r ? "bg-ink text-white" : "border border-line bg-white"}`}>
                      {r} %
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 1. Práce */}
        <Section title="1. Popis prací" hint="Co se účtuje zákazníkovi" total={summary ? formatCzk(summary.revenue.work) : "—"}
          onAdd={() => addRow("work", emptyWork())}>
          {d.work.map((w, i) => (
            <Row key={w.key} tools={rowTools("work", w.key, i, d.work.length)}>
              <input className="field col-span-2 sm:col-span-6" aria-label="Popis práce" placeholder="Popis práce" value={w.description} onChange={(e) => updateRow("work", w.key, { description: e.target.value })} />
              <NumField label="Množství" value={w.qty} onChange={(v) => updateRow("work", w.key, { qty: v })} className="sm:col-span-2" />
              <UnitSelect value={w.unit} onChange={(v) => updateRow("work", w.key, { unit: v })} />
              <NumField label="Kč/j bez DPH" value={w.unitPrice} onChange={(v) => updateRow("work", w.key, { unitPrice: v })} className="sm:col-span-2" />
              <LineTotal value={lineTotal(parseInput(w.qty), parseInput(w.unitPrice))} />
            </Row>
          ))}
        </Section>

        {/* 2. Materiály */}
        <Section title="2. Materiály" hint={`Prodejní cena = nákup + ${markupPct.replace(".", ",")} % přirážka`} total={summary ? formatCzk(summary.revenue.materials) : "—"}
          onAdd={() => addRow("materials", emptyMaterial())}>
          {d.materials.map((m, i) => (
            <Row key={m.key} tools={rowTools("materials", m.key, i, d.materials.length)}>
              <input className="field col-span-2 sm:col-span-6" aria-label="Popis materiálu" placeholder="Materiál" value={m.description} onChange={(e) => updateRow("materials", m.key, { description: e.target.value })} />
              <NumField label="Množství" value={m.qty} onChange={(v) => updateRow("materials", m.key, { qty: v })} className="sm:col-span-2" />
              <UnitSelect value={m.unit} onChange={(v) => updateRow("materials", m.key, { unit: v })} />
              <NumField label="Nákup Kč/j" value={m.purchasePrice} className="sm:col-span-2"
                onChange={(v) => {
                  const auto = toInput(salePriceFromMarkup(parseInput(m.purchasePrice), parseInput(markupPct)));
                  const follow = m.salePrice === "" || m.salePrice === auto;
                  updateRow("materials", m.key, { purchasePrice: v, ...(follow ? { salePrice: toInput(salePriceFromMarkup(parseInput(v), parseInput(markupPct))) } : {}) });
                }} />
              <NumField label="Prodej Kč/j" value={m.salePrice} onChange={(v) => updateRow("materials", m.key, { salePrice: v })} className="sm:col-span-2" />
              <label className="flex items-center gap-2 text-[14px] sm:col-span-4">
                <input type="checkbox" className="size-5 accent-accent" checked={m.billable} onChange={(e) => updateRow("materials", m.key, { billable: e.target.checked })} />
                Účtovat zákazníkovi
              </label>
              <LineTotal value={m.billable ? lineTotal(parseInput(m.qty), parseInput(m.salePrice)) : 0} note={m.billable ? undefined : "jen náklad"} />
            </Row>
          ))}
        </Section>

        {/* 3. Zaměstnanci */}
        <Section title="3. Zaměstnanci" hint="Nákladová sazba se předvyplní z karty člověka" total={summary ? formatCzk(summary.costs.labor) : "—"}
          onAdd={employees.length ? () => addRow("labor", newLabor()) : undefined}>
          {employees.length === 0 && <p className="px-1 text-[14px] text-muted">Nejdřív přidejte lidi v sekci <a className="text-accent underline" href="/app/zamestnanci">Lidé</a>.</p>}
          {d.labor.map((l, i) => {
            const emp = employees.find((e) => e.id === l.employeeId);
            return (
              <Row key={l.key} tools={rowTools("labor", l.key, i, d.labor.length)}>
                <select className="field col-span-2 sm:col-span-6" aria-label="Pracovník" value={l.employeeId}
                  onChange={(e) => {
                    const ne = employees.find((x) => x.id === e.target.value);
                    updateRow("labor", l.key, { employeeId: e.target.value, rate: ne ? toInput(parseInput(l.unit === "den" ? ne.rateDay : ne.rateHour)) : l.rate });
                  }}>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <NumField label="Množství" value={l.qty} onChange={(v) => updateRow("labor", l.key, { qty: v })} className="sm:col-span-2" />
                <label className="block sm:col-span-2">
                <span className="mb-0.5 block text-[11px] font-medium text-muted">Jednotka</span>
                <select className="field" value={l.unit}
                  onChange={(e) => {
                    const u = e.target.value as "hod" | "den";
                    updateRow("labor", l.key, { unit: u, rate: emp ? toInput(parseInput(u === "den" ? emp.rateDay : emp.rateHour)) : l.rate });
                  }}>
                  <option value="den">dnů</option>
                  <option value="hod">hodin</option>
                </select>
                </label>
                <NumField label={`Kč/${l.unit === "den" ? "den" : "hod"}`} value={l.rate} onChange={(v) => updateRow("labor", l.key, { rate: v })} className="sm:col-span-2" />
                <LineTotal value={lineTotal(parseInput(l.qty), parseInput(l.rate))} note="náklad" />
              </Row>
            );
          })}
        </Section>

        {/* 4. Výdaje */}
        <Section title="4. Výdaje" hint="Doprava, plošina, ubytování, skládka, subdodavatel" total={summary ? formatCzk(summary.costs.expenses) : "—"}
          onAdd={() => addRow("expenses", emptyExpense())}>
          {d.expenses.map((x, i) => (
            <Row key={x.key} tools={rowTools("expenses", x.key, i, d.expenses.length)}>
              <input className="field col-span-2 sm:col-span-6" aria-label="Popis výdaje" placeholder="Výdaj" value={x.description} onChange={(e) => updateRow("expenses", x.key, { description: e.target.value })} />
              <NumField label="Množství" value={x.qty} onChange={(v) => updateRow("expenses", x.key, { qty: v })} className="sm:col-span-3" />
              <NumField label="Kč/j" value={x.unitPrice} onChange={(v) => updateRow("expenses", x.key, { unitPrice: v })} className="sm:col-span-3" />
              <LineTotal value={lineTotal(parseInput(x.qty), parseInput(x.unitPrice))} note="náklad" />
            </Row>
          ))}
        </Section>

        <section className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Sleva a poznámka</h2>
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <select className="field" aria-label="Typ slevy" value={d.discountKind} onChange={(e) => set("discountKind", e.target.value as JobDraft["discountKind"])}>
              <option value="">Bez slevy</option>
              <option value="percent">Sleva v %</option>
              <option value="amount">Sleva v Kč</option>
            </select>
            {d.discountKind && <NumField label={d.discountKind === "percent" ? "%" : "Kč"} value={d.discountValue} onChange={(v) => set("discountValue", v)} />}
          </div>
          <textarea className="field min-h-24" aria-label="Poznámka" placeholder="Poznámka k zakázce" value={d.note} onChange={(e) => set("note", e.target.value)} />
        </section>
      </div>

      {/* 5. Souhrn – na mobilu přilepený dole, na počítači vpravo */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="fixed inset-x-0 bottom-14 z-10 border-t border-line bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] sm:bottom-0 lg:static lg:rounded-2xl lg:border lg:shadow-none">
          {summary ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Figure label="Náklady" value={formatCzk(summary.costs.total)} />
                <Figure label="Cena bez DPH" value={formatCzk(summary.revenue.net)} strong />
                <Figure label="Výdělek" value={formatCzk(summary.profit)} tone={summary.profit < 0 ? "bad" : "good"} />
                <Figure label="Marže" value={summary.marginBp === null ? "—" : formatPercent(summary.marginBp)} tone={summary.lowMargin ? "bad" : "good"} />
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2 text-[14px]">
                <span className="text-muted">
                  {d.vatMode === "standard" ? `DPH ${summary.vatRate} % ${formatCzk(summary.vat)}` : VAT_MODE_LABELS[d.vatMode]}
                </span>
                <span className="num font-display text-[18px] font-extrabold">{formatCzk(summary.gross)}</span>
              </div>
              {summary.lowMargin && <p className="mt-1 text-[13px] font-medium text-warn">Marže je pod vaší hranicí {minMarginPct.replace(".", ",")} %.</p>}
              <details className="mt-2 hidden text-[13px] text-muted lg:block">
                <summary className="cursor-pointer">Rozpad nákladů</summary>
                <p className="num mt-1">Materiál {formatCzk(summary.costs.materials)} · Lidé {formatCzk(summary.costs.labor)} · Výdaje {formatCzk(summary.costs.expenses)}</p>
                {summary.revenue.discount > 0 && <p className="num">Sleva −{formatCzk(summary.revenue.discount)}</p>}
              </details>
            </>
          ) : (
            <p className="text-[14px] text-warn">{calcError}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="btn-primary flex-1" onClick={onSave} disabled={saving}>
              {saving ? "Ukládám…" : "Uložit zakázku"}
            </button>
            {message && <span className={`text-[13px] font-medium ${message.ok ? "text-ok" : "text-warn"}`} role="status">{message.text}</span>}
          </div>
        </div>
      </aside>
      <div className="h-48 lg:hidden" aria-hidden="true" />
    </div>
  );
}

function Section({ title, hint, total, onAdd, children }: { title: string; hint: string; total: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-bold">{title}</h2>
          <p className="text-[13px] text-muted">{hint}</p>
        </div>
        <p className="num shrink-0 font-semibold">{total}</p>
      </div>
      <div className="space-y-3">{children}</div>
      {onAdd && (
        <button type="button" onClick={onAdd} className="btn-ghost mt-3 w-full border-dashed text-accent">
          + Přidat
        </button>
      )}
    </section>
  );
}

function Row({ tools, children }: { tools: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-paper/60 p-3">
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-12">{children}</div>
      <div className="mt-2 flex justify-end">{tools}</div>
    </div>
  );
}

function NumField({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-0.5 block text-[11px] font-medium text-muted">{label}</span>
      <input
        className="field num text-right"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,.\-]/g, ""))}
      />
    </label>
  );
}

function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block sm:col-span-2">
      <span className="mb-0.5 block text-[11px] font-medium text-muted">Jednotka</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {DEFAULT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </label>
  );
}

function LineTotal({ value, note }: { value: number; note?: string }) {
  return (
    <p className="num col-span-2 self-center text-right font-semibold sm:col-span-12">
      {note && <span className="mr-2 text-[12px] font-normal text-muted">{note}</span>}
      {formatCzk(value)}
    </p>
  );
}

function Figure({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`num font-display text-[17px] font-extrabold ${tone === "bad" ? "text-warn" : tone === "good" ? "text-ok" : ""} ${strong ? "text-ink" : ""}`}>{value}</p>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`flex size-9 items-center justify-center rounded-lg border border-line bg-white text-[15px] disabled:opacity-30 ${danger ? "text-warn" : "text-muted"}`}>
      {children}
    </button>
  );
}
