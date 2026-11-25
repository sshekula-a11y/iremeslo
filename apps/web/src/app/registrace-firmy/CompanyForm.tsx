"use client";

import { useActionState, useState } from "react";
import { checkTrial, registerCompany, type RegisterState, type TrialInfo } from "./actions";
import { formatDate } from "@/lib/format";
import type { AresCompany } from "@/lib/types";

export function CompanyForm({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerCompany, {});
  const [ico, setIco] = useState("");
  const [values, setValues] = useState({ name: "", dic: "", street: "", city: "", zip: "", vatPayer: false, registerEntry: "" });
  const [lookup, setLookup] = useState<{ loading: boolean; message?: string; ok?: boolean }>({ loading: false });
  const [trial, setTrial] = useState<{ ico: string; info: TrialInfo } | null>(null);

  // Zkušební období se váže na IČO – ukážeme hned, jestli ho firma ještě má.
  async function refreshTrial(value: string) {
    if (value.length !== 8) return setTrial(null);
    const info = await checkTrial(value);
    setTrial(info ? { ico: value, info } : null);
  }

  async function loadFromAres(value = ico) {
    setLookup({ loading: true });
    try {
      const res = await fetch(`/api/ares/${encodeURIComponent(value.trim())}`);
      const body = (await res.json()) as AresCompany | { error: string };
      if (!res.ok || "error" in body) {
        setLookup({ loading: false, message: "error" in body ? body.error : "Údaje se nepodařilo načíst." });
        return;
      }
      setValues({ name: body.name, dic: body.dic ?? "", street: body.street, city: body.city, zip: body.zip, vatPayer: body.vatPayer, registerEntry: body.registerEntry ?? "" });
      setIco(body.ico);
      setLookup({ loading: false, ok: true, message: "Údaje jsme načetli z ARES. Zkontrolujte je." });
      void refreshTrial(body.ico);
    } catch {
      setLookup({ loading: false, message: "ARES teď neodpovídá. Údaje vyplňte ručně." });
    }
  }

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: k === "vatPayer" ? e.target.checked : e.target.value }));

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="label" htmlFor="ico">IČO</label>
        <div className="flex gap-2">
          <input
            className="field num"
            id="ico"
            name="ico"
            inputMode="numeric"
            maxLength={8}
            value={ico}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setIco(v);
              void refreshTrial(v);
              // Po 8. číslici načteme název, adresu i DIČ z ARES sami – bez klikání.
              if (v.length === 8 && v !== ico) void loadFromAres(v);
            }}
            placeholder="např. 25020137"
            required
            aria-describedby="trial-info"
          />
          <button type="button" className="btn-dark shrink-0" onClick={() => loadFromAres()} disabled={ico.length < 6 || lookup.loading}>
            {lookup.loading ? "Hledám…" : "Načíst z ARES"}
          </button>
        </div>
        {lookup.message && (
          <p className={`mt-1.5 text-[13px] ${lookup.ok ? "text-ok" : "text-warn"}`} role="status">{lookup.message}</p>
        )}
        <div id="trial-info" aria-live="polite">{trial && trial.ico === ico && <TrialNotice ico={ico} info={trial.info} />}</div>
      </div>

      <div>
        <label className="label" htmlFor="name">Název firmy nebo jméno</label>
        <input className="field" id="name" name="name" required value={values.name} onChange={set("name")} />
      </div>
      <div>
        <label className="label" htmlFor="street">Ulice a číslo</label>
        <input className="field" id="street" name="street" value={values.street} onChange={set("street")} />
      </div>
      <div className="grid grid-cols-[1fr_7.5rem] gap-3">
        <div>
          <label className="label" htmlFor="city">Obec</label>
          <input className="field" id="city" name="city" value={values.city} onChange={set("city")} />
        </div>
        <div>
          <label className="label" htmlFor="zip">PSČ</label>
          <input className="field num" id="zip" name="zip" inputMode="numeric" value={values.zip} onChange={set("zip")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="register_entry">Zápis v rejstříku (na doklady)</label>
        <input className="field" id="register_entry" name="register_entry" value={values.registerEntry} onChange={set("registerEntry")}
          placeholder="Doplníme z ARES po zadání IČO" />
      </div>

      <div>
        <label className="label" htmlFor="dic">DIČ {values.vatPayer ? "(povinné)" : "(pokud máte)"}</label>
        <input className="field num" id="dic" name="dic" value={values.dic} onChange={set("dic")} placeholder="CZ12345678" />
      </div>
      <label className="flex items-center gap-2.5 text-[15px] font-medium">
        <input type="checkbox" name="vatPayer" className="size-5 accent-accent" checked={values.vatPayer} onChange={set("vatPayer")} />
        Jsem plátce DPH
      </label>

      {state.error && <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Zakládám…" : "Založit firmu"}
      </button>
      <p className="text-center text-[13px] text-muted">30 dní zdarma, bez platební karty a bez závazků. Zkušební období platí jednou pro každé IČO.</p>
    </form>
  );
}

function TrialNotice({ ico, info }: { ico: string; info: TrialInfo }) {
  if (!info.used) {
    return <p className="mt-2 rounded-xl bg-ok-soft px-3 py-2 text-[14px] text-ok">Pro IČO {ico} máte {info.days} dní zdarma.</p>;
  }
  if (info.active) {
    return (
      <div className="mt-2 rounded-xl bg-accent-soft px-3 py-2.5 text-[14px]">
        <p className="font-semibold">Pro IČO {ico} už zkušební období běží (do {formatDate(info.trialEnd)}).</p>
        <p className="mt-0.5 text-muted">Nová registrace ho neprodlouží. Pokud vaše firma již účet má, požádejte jeho majitele o pozvánku.</p>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px]" role="alert">
      <p className="font-semibold text-warn">Pro IČO {ico} už bylo zkušební období vyčerpané (skončilo {formatDate(info.trialEnd)}).</p>
      <p className="mt-0.5 text-ink">Firmu založit můžete, ale zakázky a doklady půjde vytvářet až s předplatným. Pokud vaše firma již účet má, požádejte jeho majitele o pozvánku.</p>
    </div>
  );
}
