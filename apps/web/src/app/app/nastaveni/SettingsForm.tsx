"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { czAccountToIban, formatIban } from "@iremeslo/core";
import { saveCompany, type SettingsState } from "./actions";

export interface CompanySettings {
  name: string; ico: string; dic: string; street: string; city: string; zip: string;
  email: string; phone: string; web: string; registerEntry: string;
  bankAccount: string; iban: string; bic: string;
  vatPayer: boolean; defaultVatRate: "21" | "12"; paymentTermsDays: string;
  markupPct: string; minMarginPct: string;
}

export function SettingsForm({ initial, canEdit }: { initial: CompanySettings; canEdit: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveCompany, {});
  const [vatPayer, setVatPayer] = useState(initial.vatPayer);
  const [account, setAccount] = useState(initial.bankAccount);

  let ibanPreview: { ok: boolean; text: string } | null = null;
  if (account.trim()) {
    try {
      ibanPreview = { ok: true, text: `IBAN ${formatIban(czAccountToIban(account))}` };
    } catch (e) {
      ibanPreview = { ok: false, text: e instanceof Error ? e.message : "Neplatné číslo účtu" };
    }
  }

  return (
    // Odeslání bez resetu formuláře: při chybě zůstane vše, co majitel vyplnil.
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(() => action(data));
    }}>
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <Section title="Údaje na dokladech" hint="Zobrazí se na nabídkách a fakturách jako údaje dodavatele.">
          <Field id="name" label="Název firmy nebo jméno" defaultValue={initial.name} required className="sm:col-span-2" />
          <Field id="ico" label="IČO" defaultValue={initial.ico} inputMode="numeric" maxLength={8} num />
          <Field id="dic" label={vatPayer ? "DIČ (povinné)" : "DIČ"} defaultValue={initial.dic} placeholder="CZ12345678" />
          <Field id="street" label="Ulice a číslo" defaultValue={initial.street} className="sm:col-span-2" />
          <Field id="city" label="Obec" defaultValue={initial.city} />
          <Field id="zip" label="PSČ" defaultValue={initial.zip} inputMode="numeric" num />
          <Field id="phone" label="Telefon" defaultValue={initial.phone} type="tel" />
          <Field id="email" label="E-mail" defaultValue={initial.email} type="email" />
          <Field id="web" label="Web" defaultValue={initial.web} placeholder="www.example.cz" />
          <RegisterEntryField initial={initial.registerEntry} canEdit={canEdit} />
        </Section>

        <Section title="DPH a platby">
          <label className="flex items-center gap-3 sm:col-span-2">
            <input type="checkbox" name="vat_payer" className="size-5 accent-accent" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
            <span className="font-medium">Jsem plátce DPH</span>
          </label>
          {vatPayer && (
            <div>
              <span className="label">Výchozí sazba u nové zakázky</span>
              <div className="grid grid-cols-2 gap-2">
                {(["21", "12"] as const).map((r) => (
                  <label key={r} className="btn border border-line bg-white has-checked:border-ink has-checked:bg-ink has-checked:text-white">
                    <input type="radio" name="default_vat_rate" value={r} defaultChecked={initial.defaultVatRate === r} className="sr-only" /> {r} %
                  </label>
                ))}
              </div>
            </div>
          )}
          {!vatPayer && <input type="hidden" name="default_vat_rate" value="21" />}
          <Field id="payment_terms_days" label="Splatnost faktur (dní)" defaultValue={initial.paymentTermsDays} inputMode="numeric" num />
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bank_account">Číslo účtu</label>
            <input className="field num" id="bank_account" name="bank_account" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="123456789/0800" />
            {ibanPreview && <p className={`mt-1 text-[13px] ${ibanPreview.ok ? "text-muted" : "text-warn"}`}>{ibanPreview.text}</p>}
            {!account.trim() && <p className="mt-1 text-[13px] text-muted">Bez účtu nebude na faktuře QR Platba.</p>}
          </div>
          {!account.trim() && <Field id="iban" label="IBAN (zahraniční účet)" defaultValue={initial.iban} />}
          {account.trim() && <input type="hidden" name="iban" value="" />}
          <Field id="bic" label="BIC / SWIFT (nepovinné)" defaultValue={initial.bic} />
        </Section>

        <Section title="Výpočty zakázek">
          <Field id="material_markup_pct" label="Přirážka na materiál (%)" defaultValue={initial.markupPct} inputMode="decimal" num
            hint="Prodejní cena se dopočítá z nákupní." />
          <Field id="min_margin_pct" label="Upozornit, když marže klesne pod (%)" defaultValue={initial.minMarginPct} inputMode="decimal" num
            hint="Souhrn zakázky se zbarví červeně." />
        </Section>
      </fieldset>

      {canEdit ? (
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-3 rounded-2xl border border-line bg-white p-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] sm:bottom-4 kb:hidden">
          <button className="btn-primary" disabled={pending}>{pending ? "Ukládám…" : "Uložit nastavení"}</button>
          {state.error && <p className="text-[13px] font-medium text-warn" role="alert">{state.error}</p>}
          {state.ok && !pending && <p className="text-[13px] font-medium text-ok" role="status">Uloženo</p>}
        </div>
      ) : (
        <p className="text-[14px] text-muted">Údaje firmy může měnit jen majitel.</p>
      )}
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="font-display text-[17px] font-bold">{title}</h2>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, num, className = "", ...rest }: {
  id: string; label: string; hint?: string; num?: boolean; className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <input className={`field ${num ? "num" : ""}`} id={id} name={id} {...rest} />
      {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/** Zápis v rejstříku s tlačítkem „Doplnit z ARES“ (spisová značka, nebo zápis v živnostenském rejstříku). */
function RegisterEntryField({ initial, canEdit }: { initial: string; canEdit: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    const ico = (ref.current?.form?.elements.namedItem("ico") as HTMLInputElement | null)?.value.trim() ?? "";
    if (!/^\d{6,8}$/.test(ico)) return setMsg({ ok: false, text: "Nejdřív vyplňte IČO." });
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/ares/${encodeURIComponent(ico)}`);
      const j = (await res.json()) as { registerEntry?: string | null; error?: string };
      if (!res.ok) return setMsg({ ok: false, text: j.error ?? "ARES teď neodpovídá." });
      if (!j.registerEntry) return setMsg({ ok: false, text: "ARES zápis v rejstříku pro toto IČO neuvádí. Vyplňte ho ručně." });
      if (ref.current) ref.current.value = j.registerEntry;
      setMsg({ ok: true, text: "Doplněno z ARES. Nezapomeňte nastavení uložit." });
    } catch {
      setMsg({ ok: false, text: "ARES teď neodpovídá. Vyplňte údaj ručně." });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="sm:col-span-2">
      <label className="label" htmlFor="register_entry">Zápis v rejstříku</label>
      <div className="flex gap-2">
        <input ref={ref} className="field" id="register_entry" name="register_entry" defaultValue={initial}
          placeholder="např. Zapsáno v obchodním rejstříku vedeném Krajským soudem v Brně, oddíl C, vložka 12345" />
        {canEdit && (
          <button type="button" className="btn-ghost shrink-0" onClick={load} disabled={loading}>{loading ? "Hledám…" : "Doplnit z ARES"}</button>
        )}
      </div>
      {msg ? <p className={`mt-1 text-[13px] ${msg.ok ? "text-ok" : "text-warn"}`} role="status">{msg.text}</p>
        : <p className="mt-1 text-[13px] text-muted">Povinný údaj na dokladech. Živnostníkům stačí „Zapsán v živnostenském rejstříku“.</p>}
    </div>
  );
}
