"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceAmount, formatCzk } from "@iremeslo/core";
import { parseInput } from "@/lib/money";
import { createAdvance, createInvoice } from "../actions";

/** Potvrzení faktury: DUZP a vystavení. Vystavená faktura už nejde změnit, proto jasné upozornění. */
export function IssueInvoiceForm({ jobId, defaultTaxableDate, minDate, maxDate, showTaxable }: {
  jobId: string; defaultTaxableDate: string; minDate: string; maxDate: string; showTaxable: boolean;
}) {
  const router = useRouter();
  const [taxable, setTaxable] = useState(defaultTaxableDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card space-y-3 p-4">
      {showTaxable && (
        <div>
          <label className="label" htmlFor="duzp">Datum zdanitelného plnění (DUZP)</label>
          <input id="duzp" type="date" className="field max-w-56" value={taxable} min={minDate} max={maxDate} onChange={(e) => setTaxable(e.target.value)} />
          <p className="mt-1 text-[13px] text-muted">Obvykle den dokončení práce. Předvyplnili jsme konec termínu zakázky.</p>
        </div>
      )}
      <p className="text-[13px] text-muted">Po vystavení dostane faktura číslo a poté ji již nebude možné změnit ani smazat.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => {
          setError(null);
          start(async () => {
            const res = await createInvoice(jobId, taxable);
            if (!res.ok) return setError(res.error);
            router.push(`/app/doklady/${res.id}`);
          });
        }}>
          {pending ? "Vystavuji…" : "Vystavit fakturu"}
        </button>
        {error && <p className="text-[13px] font-medium text-warn" role="alert">{error}</p>}
      </div>
    </div>
  );
}

/** Zálohová faktura: % z ceny s DPH nebo pevná částka, výsledek se ukazuje hned. */
export function IssueAdvanceForm({ jobId, gross, grossLabel }: { jobId: string; gross: number; grossLabel: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  let amount: { ok: boolean; text: string };
  try {
    const n = parseInput(value);
    const a = advanceAmount(gross, kind === "percent" ? { percentBp: n } : { amount: n });
    amount = { ok: true, text: formatCzk(a) };
  } catch (e) {
    amount = { ok: false, text: e instanceof Error ? e.message : "Neplatná výše" };
  }

  return (
    <div className="card space-y-4 p-4">
      <p className="text-[14px] text-muted">Cena zakázky {grossLabel}: <span className="num font-semibold text-ink">{formatCzk(gross)}</span></p>
      <div className="grid grid-cols-2 gap-2 sm:max-w-80">
        {([["percent", "V procentech"], ["amount", "Částkou v Kč"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setKind(k); setValue(k === "percent" ? "30" : ""); }}
            className={`btn ${kind === k ? "bg-ink text-white" : "border border-line bg-white"}`}>{label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="adv">{kind === "percent" ? "Záloha (%)" : "Záloha (Kč)"}</label>
          <input id="adv" className="field num w-40 text-right" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d,.]/g, ""))} />
        </div>
        <div className="pb-1">
          <p className="text-[12px] text-muted">Záloha k úhradě</p>
          <p className={`num font-display text-[22px] font-extrabold ${amount.ok ? "" : "text-warn text-[14px] font-medium"}`}>{amount.text}</p>
        </div>
      </div>
      <p className="text-[13px] text-muted">Zálohová faktura není daňový doklad. Po zaplacení se plátci DPH vystaví daňový doklad k přijaté platbě a na konečné faktuře se záloha odečte.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending || !amount.ok} onClick={() => {
          setError(null);
          start(async () => {
            const res = await createAdvance(jobId, { kind, value });
            if (!res.ok) return setError(res.error);
            router.push(`/app/doklady/${res.id}`);
          });
        }}>
          {pending ? "Vystavuji…" : "Vystavit zálohovou fakturu"}
        </button>
        {error && <p className="text-[13px] font-medium text-warn" role="alert">{error}</p>}
      </div>
    </div>
  );
}
