"use client";

import { useState, useTransition } from "react";
import { saveProfessions } from "./actions";

export const MAX_PROFESSIONS = 5;

/** Výběr až 5 profesí firmy; ostatní volby se po dosažení limitu zamknou. */
export function ProfessionPicker({ options, initial, canEdit }: {
  options: { slug: string; name: string }[]; initial: string[]; canEdit: boolean;
}) {
  const [sel, setSel] = useState<string[]>(initial);
  const [saved, setSaved] = useState<string[]>(initial);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const full = sel.length >= MAX_PROFESSIONS;
  const dirty = sel.length !== saved.length || sel.some((s) => !saved.includes(s));

  const toggle = (slug: string) => {
    setMsg(null);
    setSel((v) => (v.includes(slug) ? v.filter((s) => s !== slug) : v.length >= MAX_PROFESSIONS ? v : [...v, slug]));
  };

  return (
    <section id="profese" className="card scroll-mt-4 space-y-3 p-4 sm:p-5" aria-labelledby="profese-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="profese-title" className="font-display text-[19px] font-bold">Profese firmy</h2>
        <p className={`num text-[14px] font-semibold ${full ? "text-accent-ink" : "text-muted"}`} aria-live="polite">{sel.length} z {MAX_PROFESSIONS}</p>
      </div>
      <p className="text-[14px] text-muted">
        Vyberte až {MAX_PROFESSIONS} profesí, které vaše firma dělá. V poptávkách pak jedním klepnutím uvidíte jen ty z vašich oborů.
      </p>
      <fieldset disabled={!canEdit || pending} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Profese</legend>
        {options.map((o) => {
          const on = sel.includes(o.slug);
          const locked = !on && full;
          return (
            <label key={o.slug} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-[15px] transition ${on ? "border-ink bg-ink text-white" : "border-line bg-white"} ${locked ? "cursor-not-allowed opacity-45" : ""}`}>
              <input type="checkbox" className="size-4 accent-accent" checked={on} disabled={locked} onChange={() => toggle(o.slug)} />
              {o.name}
            </label>
          );
        })}
      </fieldset>
      {full && canEdit && <p className="text-[13px] text-muted">Máte vybraných {MAX_PROFESSIONS} profesí. Pro jinou nejdřív některou odeberte.</p>}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-dark min-h-10" disabled={pending || !dirty} onClick={() => start(async () => {
            const res = await saveProfessions(sel);
            setMsg(res);
            if (res.ok) setSaved(sel);
          })}>{pending ? "Ukládám…" : "Uložit profese"}</button>
          {msg?.error && <p className="text-[13px] font-medium text-warn" role="alert">{msg.error}</p>}
          {msg?.ok && !dirty && <p className="text-[13px] font-medium text-ok" role="status">Uloženo</p>}
        </div>
      ) : <p className="text-[13px] text-muted">Profese může měnit majitel firmy.</p>}
    </section>
  );
}
