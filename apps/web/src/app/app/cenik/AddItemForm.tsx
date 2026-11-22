"use client";

import { useState } from "react";
import { addCatalogItem } from "./actions";
import { ItemFields } from "./ItemFields";

export function AddItemForm({ markupPct }: { markupPct: string }) {
  // Po uložení se políčka vyprázdní (nový klíč = čistý formulář), druh položky zůstane.
  const [round, setRound] = useState(0);
  const [kind, setKind] = useState<"work" | "material">("work");

  return (
    <form
      className="card space-y-3 p-4"
      action={async (form) => {
        await addCatalogItem(form);
        setKind(form.get("kind") === "material" ? "material" : "work");
        setRound((r) => r + 1);
      }}
    >
      <h2 className="font-display text-[17px] font-bold">Nová položka</h2>
      <ItemFields key={round} idPrefix="new" markupPct={markupPct}
        initial={{ kind, name: "", unit: kind === "work" ? "m²" : "ks", purchasePrice: "", salePrice: "" }} />
      <button className="btn-primary w-full">Uložit do ceníku</button>
    </form>
  );
}
