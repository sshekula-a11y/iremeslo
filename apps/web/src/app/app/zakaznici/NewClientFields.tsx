"use client";

import { useState } from "react";
import { aresStatusClass, useAres } from "@/lib/use-ares";

/** Nový zákazník: u firmy stačí IČO – název, adresa a DIČ se načtou z ARES samy. */
export function NewClientFields() {
  const [kind, setKind] = useState<"person" | "company">("person");
  const [v, setV] = useState({ name: "", ico: "", dic: "", street: "", city: "", zip: "" });
  const { status, onIcoInput } = useAres((c) => {
    setKind("company");
    setV((x) => ({ ...x, ico: c.ico, name: c.name, dic: c.dic ?? "", street: c.street, city: c.city, zip: c.zip }));
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-[14px]">
        <label className="flex items-center gap-2"><input type="radio" name="kind" value="person" checked={kind === "person"} onChange={() => setKind("person")} className="accent-accent" /> Osoba</label>
        <label className="flex items-center gap-2"><input type="radio" name="kind" value="company" checked={kind === "company"} onChange={() => setKind("company")} className="accent-accent" /> Firma</label>
      </div>
      <div>
        <label className="label" htmlFor="c-ico">IČO (u firmy – ostatní údaje doplníme z ARES)</label>
        <input className="field num" id="c-ico" name="ico" inputMode="numeric" maxLength={8} value={v.ico}
          onChange={(e) => { const ico = e.target.value.replace(/\D/g, "").slice(0, 8); setV((x) => ({ ...x, ico })); onIcoInput(ico); }} />
        {(status.loading || status.message) && (
          <p className={`mt-1 text-[13px] ${aresStatusClass(status)}`} role="status">{status.loading ? "Načítám z ARES…" : status.message}</p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="c-name">Jméno nebo název</label>
        <input className="field" id="c-name" name="name" required value={v.name} onChange={set("name")} />
      </div>
      {kind === "company" && (
        <div>
          <label className="label" htmlFor="c-dic">DIČ</label>
          <input className="field" id="c-dic" name="dic" value={v.dic} onChange={set("dic")} placeholder="CZ12345678" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="c-phone">Telefon</label>
        <input className="field" id="c-phone" name="phone" type="tel" />
      </div>
      <div>
        <label className="label" htmlFor="c-email">E-mail</label>
        <input className="field" id="c-email" name="email" type="email" />
      </div>
      <div>
        <label className="label" htmlFor="c-street">Adresa</label>
        <input className="field" id="c-street" name="street" placeholder="Ulice a číslo" value={v.street} onChange={set("street")} />
        <div className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2">
          <input className="field" name="city" placeholder="Obec" aria-label="Obec" value={v.city} onChange={set("city")} />
          <input className="field num" name="zip" placeholder="PSČ" aria-label="PSČ" inputMode="numeric" value={v.zip} onChange={set("zip")} />
        </div>
      </div>
    </>
  );
}
