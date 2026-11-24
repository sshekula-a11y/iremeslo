"use client";

import { startTransition, useActionState, useState } from "react";
import { INQUIRY_CATEGORIES, INQUIRY_TERMS, INQUIRY_UNITS } from "@/lib/inquiries";
import { submitInquiry, type InquiryState } from "./actions";

export function InquiryForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitInquiry, {});
  const [term, setTerm] = useState("flexible");
  const [termFrom, setTermFrom] = useState("");

  return (
    // Odeslání bez resetu formuláře: při chybě zůstane vše vyplněné.
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(() => action(data));
    }}>
      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-[19px] font-bold">Co poptáváte</h2>
        <div>
          <label className="label" htmlFor="category">Obor</label>
          <select className="field" id="category" name="category" required defaultValue="">
            <option value="" disabled>Vyberte obor</option>
            {INQUIRY_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="title">Stručný název</label>
          <input className="field" id="title" name="title" required minLength={5} maxLength={120} placeholder="např. Zateplení fasády rodinného domu" />
        </div>
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <div>
            <label className="label" htmlFor="quantity">Rozsah (nepovinné)</label>
            <input className="field num" id="quantity" name="quantity" inputMode="decimal" placeholder="např. 500" />
          </div>
          <div>
            <label className="label" htmlFor="unit">Jednotka</label>
            <select className="field" id="unit" name="unit" defaultValue="m2">
              <option value="">—</option>
              {INQUIRY_UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">Popis práce</label>
          <textarea className="field min-h-32" id="description" name="description" required minLength={20} maxLength={3000}
            placeholder="Co je potřeba udělat, materiál, stav objektu, přístup (lešení, parkování)…" />
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-[19px] font-bold">Kde a kdy</h2>
        <div className="grid grid-cols-[1fr_7.5rem] gap-3">
          <div>
            <label className="label" htmlFor="city">Obec</label>
            <input className="field" id="city" name="city" required placeholder="např. Brno" autoComplete="address-level2" />
          </div>
          <div>
            <label className="label" htmlFor="zip">PSČ</label>
            <input className="field num" id="zip" name="zip" inputMode="numeric" placeholder="602 00" autoComplete="postal-code" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="street">Ulice a číslo (nepovinné)</label>
          <input className="field" id="street" name="street" autoComplete="street-address" />
          <p className="mt-1 text-[13px] text-muted">Veřejně ukážeme jen obec a PSČ. Ulici uvidí pouze registrovaní řemeslníci.</p>
        </div>
        <fieldset>
          <legend className="label">Termín realizace</legend>
          <div className="grid grid-cols-3 gap-2">
            {INQUIRY_TERMS.map(([v, l]) => (
              <label key={v} className="btn border border-line bg-white px-2 text-center has-checked:border-ink has-checked:bg-ink has-checked:text-white">
                <input type="radio" name="term" value={v} checked={term === v} onChange={() => setTerm(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        {term === "date" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="term_from">Zahájení</label>
              <input className="field num" id="term_from" name="term_from" type="date" min={today} value={termFrom} onChange={(e) => setTermFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="term_date">Dokončení</label>
              <input className="field num" id="term_date" name="term_date" type="date" min={termFrom || today} />
            </div>
            <p className="col-span-2 text-[13px] text-muted">Stačí vyplnit jedno z dat.</p>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-[19px] font-bold">Váš kontakt</h2>
          <p className="text-[14px] text-muted">Uvidí ho jen registrovaní řemeslníci s ověřeným e-mailem, nikoli veřejnost.</p>
        </div>
        <div>
          <label className="label" htmlFor="contact_name">Jméno a příjmení</label>
          <input className="field" id="contact_name" name="contact_name" required autoComplete="name" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact_phone">Telefon (doporučeno)</label>
            <input className="field num" id="contact_phone" name="contact_phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="777 123 456" />
          </div>
          <div>
            <label className="label" htmlFor="contact_email">E-mail</label>
            <input className="field" id="contact_email" name="contact_email" type="email" required autoComplete="email" />
          </div>
        </div>
        {/* Past na roboty – skryté pole, člověk ho nevyplní. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="web">Web</label>
          <input id="web" name="web" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="flex items-start gap-2.5 text-[14px] text-muted">
          <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-accent" required />
          <span>
            Souhlasím se zveřejněním poptávky a s tím, že můj kontakt uvidí registrovaní řemeslníci, kteří mě mohou kvůli poptávce kontaktovat.
            Více v <a href="/ochrana-osobnich-udaju#poptavky" target="_blank" rel="noreferrer" className="font-semibold text-accent-ink underline">zásadách ochrany osobních údajů</a>.
          </span>
        </label>
      </section>

      {state.error && <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn" role="alert">{state.error}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>{pending ? "Odesílám…" : "Odeslat poptávku"}</button>
      <p className="text-[13px] text-muted">Na váš e-mail pošleme odkaz. Poptávka se zveřejní po jeho potvrzení a platí 60 dní.</p>
    </form>
  );
}
