"use client";

import { useActionState, useState } from "react";
import { registerCompany, type RegisterState } from "./actions";
import type { AresCompany } from "@/lib/types";

export function CompanyForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerCompany, {});
  const [ico, setIco] = useState("");
  const [values, setValues] = useState({ name: "", dic: "", street: "", city: "", zip: "", vatPayer: false });
  const [lookup, setLookup] = useState<{ loading: boolean; message?: string; ok?: boolean }>({ loading: false });

  async function loadFromAres() {
    setLookup({ loading: true });
    try {
      const res = await fetch(`/api/ares/${encodeURIComponent(ico.trim())}`);
      const body = (await res.json()) as AresCompany | { error: string };
      if (!res.ok || "error" in body) {
        setLookup({ loading: false, message: "error" in body ? body.error : "Nepovedlo se načíst." });
        return;
      }
      setValues({ name: body.name, dic: body.dic ?? "", street: body.street, city: body.city, zip: body.zip, vatPayer: body.vatPayer });
      setIco(body.ico);
      setLookup({ loading: false, ok: true, message: "Údaje jsme načetli z ARES. Zkontrolujte je." });
    } catch {
      setLookup({ loading: false, message: "ARES teď neodpovídá. Údaje vyplňte ručně." });
    }
  }

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: k === "vatPayer" ? e.target.checked : e.target.value }));

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
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
            onChange={(e) => setIco(e.target.value.replace(/\D/g, ""))}
            placeholder="např. 25020137"
          />
          <button type="button" className="btn-dark shrink-0" onClick={loadFromAres} disabled={ico.length < 6 || lookup.loading}>
            {lookup.loading ? "Hledám…" : "Načíst z ARES"}
          </button>
        </div>
        {lookup.message && (
          <p className={`mt-1.5 text-[13px] ${lookup.ok ? "text-ok" : "text-warn"}`} role="status">{lookup.message}</p>
        )}
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

      <label className="flex items-center gap-2.5 text-[15px] font-medium">
        <input type="checkbox" name="vatPayer" className="size-5 accent-accent" checked={values.vatPayer} onChange={set("vatPayer")} />
        Jsem plátce DPH
      </label>
      {values.vatPayer && (
        <div>
          <label className="label" htmlFor="dic">DIČ</label>
          <input className="field num" id="dic" name="dic" value={values.dic} onChange={set("dic")} placeholder="CZ12345678" />
        </div>
      )}

      {state.error && <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Zakládám…" : "Založit firmu"}
      </button>
      <p className="text-center text-[13px] text-muted">Beta je zdarma, bez karty a bez závazků.</p>
    </form>
  );
}
