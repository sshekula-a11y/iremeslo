"use client";

import { useState, useTransition } from "react";
import { REGIONS } from "@/lib/inquiries";
import { saveAlertSettings } from "./alert-actions";

export interface AlertState { enabled: boolean; frequency: "instant" | "daily"; regions: string[] }

/**
 * Upozornění na nové poptávky: zapnout/vypnout, jak často a z jakých krajů.
 * Obory se berou z profesí firmy (sekce nad tím), aby se nic nezadávalo dvakrát.
 */
export function AlertSettings({ initial, professions, verified, canEdit, received30d }: {
  initial: AlertState; professions: string[]; verified: boolean; canEdit: boolean; received30d: number;
}) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const allCz = s.regions.length === 0;

  const change = (next: AlertState) => {
    setS(next); setSaved(null); setError(null);
    if (!canEdit) return;
    start(async () => {
      const r = await saveAlertSettings(next);
      if (r.ok) setSaved("Uloženo"); else setError(r.error);
    });
  };
  const toggleRegion = (id: string) =>
    change({ ...s, regions: s.regions.includes(id) ? s.regions.filter((r) => r !== id) : [...s.regions, id] });

  const blocker = !verified ? "Upozornění začnou chodit, jakmile se ověří IČO firmy v ARES."
    : professions.length === 0 ? "Nejdřív vyberte profese firmy výše – podle nich vybíráme poptávky." : null;

  return (
    <section id="upozorneni" className="card scroll-mt-20 space-y-4 p-4 sm:p-5" aria-labelledby="upozorneni-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="upozorneni-title" className="font-display text-[17px] font-bold">Upozornění na nové poptávky</h2>
          <p className="text-[14px] text-muted">
            {s.enabled
              ? <>Pošleme e-mail, když zákazník {allCz ? "kdekoli v ČR" : "ve vybraných krajích"} zadá poptávku, která se hodí k vašim profesím{professions.length ? <> (<strong className="text-ink">{professions.join(", ")}</strong>)</> : ""}.</>
              : "Upozornění jsou vypnutá – nové poptávky najdete jen v seznamu poptávek."}
          </p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input type="checkbox" className="peer sr-only" checked={s.enabled} disabled={!canEdit} onChange={(e) => change({ ...s, enabled: e.target.checked })} aria-label="Posílat upozornění na nové poptávky" />
          <span className="h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-ok peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
          <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      {s.enabled && blocker && <p className="rounded-xl bg-accent-soft px-3 py-2 text-[14px]">{blocker}</p>}

      {s.enabled && (
        <>
          <fieldset>
            <legend className="label">Jak často</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([["instant", "Ihned", "Do 10 minut po zadání – ozvete se jako první"], ["daily", "Jednou denně", "Ráno souhrn za předchozí den"]] as const).map(([v, l, d]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-2.5 rounded-xl p-3 ring-1 ${s.frequency === v ? "bg-accent-soft ring-accent" : "ring-line hover:bg-paper"}`}>
                  <input type="radio" name="alert-frequency" className="mt-1 size-4 accent-accent" checked={s.frequency === v} disabled={!canEdit} onChange={() => change({ ...s, frequency: v })} />
                  <span><span className="block font-semibold">{l}</span><span className="block text-[13px] text-muted">{d}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Odkud</legend>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={!canEdit} onClick={() => change({ ...s, regions: [] })} aria-pressed={allCz}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${allCz ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:bg-paper"}`}>Celá ČR</button>
              {REGIONS.map(([id, label]) => {
                const on = s.regions.includes(id);
                return (
                  <button key={id} type="button" disabled={!canEdit} onClick={() => toggleRegion(id)} aria-pressed={on}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${on ? "bg-accent-soft text-ink ring-accent" : "bg-white text-ink/80 ring-line hover:bg-paper"}`}>{label}</button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[13px] text-muted">Klepnutím vyberete jeden nebo víc krajů. Bez výběru posíláme z celé republiky.</p>
          </fieldset>
        </>
      )}

      <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted" aria-live="polite">
        {received30d > 0 && <span>Za posledních 30 dní jsme vám poslali {received30d} {received30d === 1 ? "poptávku" : received30d < 5 ? "poptávky" : "poptávek"}.</span>}
        {pending && <span>Ukládám…</span>}
        {!pending && saved && <span className="font-semibold text-ok">✓ {saved}</span>}
        {error && <span className="font-semibold text-warn" role="alert">{error}</span>}
        {!canEdit && <span>Upozornění může měnit majitel firmy.</span>}
      </p>
    </section>
  );
}
