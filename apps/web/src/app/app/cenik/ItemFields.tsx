"use client";

import { useState } from "react";
import { DEFAULT_UNITS, salePriceFromMarkup } from "@iremeslo/core";
import { parseInput, toInput } from "@/lib/money";

export interface ItemValues {
  kind: "work" | "material";
  name: string;
  unit: string;
  purchasePrice: string;
  salePrice: string;
}

/** Políčka položky ceníku. U materiálu se prodejní cena dopočítá z přirážky, dokud ji uživatel nepřepíše. */
export function ItemFields({ idPrefix, initial, markupPct, lockKind }: { idPrefix: string; initial: ItemValues; markupPct: string; lockKind?: boolean }) {
  const [kind, setKind] = useState(initial.kind);
  const [purchase, setPurchase] = useState(initial.purchasePrice);
  const [sale, setSale] = useState(initial.salePrice);
  const auto = (p: string) => toInput(salePriceFromMarkup(parseInput(p), parseInput(markupPct)));
  const clean = (s: string) => s.replace(/[^\d,.]/g, "");

  return (
    <>
      {lockKind ? (
        <input type="hidden" name="kind" value={kind} />
      ) : (
        <div className="grid grid-cols-2 gap-2 text-[14px]">
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="work" checked={kind === "work"} onChange={() => setKind("work")} className="accent-accent" /> Práce
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="material" checked={kind === "material"} onChange={() => setKind("material")} className="accent-accent" /> Materiál
          </label>
        </div>
      )}
      <div>
        <label className="label" htmlFor={`${idPrefix}-name`}>Název</label>
        <input className="field" id={`${idPrefix}-name`} name="name" required defaultValue={initial.name}
          placeholder={kind === "work" ? "např. Nátěr fasády 2×" : "např. Fasádní barva bílá 15 l"} />
      </div>
      <div className={`grid gap-2 ${kind === "material" ? "grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <label className="label" htmlFor={`${idPrefix}-unit`}>Jednotka</label>
          <select className="field" id={`${idPrefix}-unit`} name="unit" defaultValue={initial.unit}>
            {DEFAULT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {kind === "material" && (
          <div>
            <label className="label" htmlFor={`${idPrefix}-buy`}>Nákup Kč/j</label>
            <input className="field num text-right" id={`${idPrefix}-buy`} name="purchase_price" inputMode="decimal" value={purchase}
              onChange={(e) => {
                const v = clean(e.target.value);
                if (sale === "" || sale === auto(purchase)) setSale(auto(v));
                setPurchase(v);
              }} />
          </div>
        )}
        <div>
          <label className="label" htmlFor={`${idPrefix}-sell`}>{kind === "material" ? "Prodej Kč/j" : "Kč/j bez DPH"}</label>
          <input className="field num text-right" id={`${idPrefix}-sell`} name="sale_price" inputMode="decimal" value={sale}
            onChange={(e) => setSale(clean(e.target.value))} />
        </div>
      </div>
    </>
  );
}
