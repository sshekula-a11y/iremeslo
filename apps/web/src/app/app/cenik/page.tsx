import type { Metadata } from "next";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { czk } from "@/lib/format";
import { toHundredths, toInput } from "@/lib/money";
import { setCatalogItemActive, updateCatalogItem } from "./actions";
import { AddItemForm } from "./AddItemForm";
import { ItemFields } from "./ItemFields";

export const metadata: Metadata = { title: "Ceník" };

interface Item {
  id: string;
  kind: "work" | "material";
  name: string;
  unit: string;
  purchase_price: string;
  sale_price: string;
  active: boolean;
}

export default async function CatalogPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_items")
    .select("id, kind, name, unit, purchase_price, sale_price, active")
    .eq("company_id", company.id)
    .order("name");
  const items = (data ?? []) as Item[];
  const active = items.filter((i) => i.active);
  const hidden = items.filter((i) => !i.active);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-5">
        <div>
          <h1 className="mb-1 font-display text-[26px] font-extrabold">Ceník</h1>
          <p className="text-[14px] text-muted">V zakázce začněte psát název a položka se doplní i s cenou a jednotkou.</p>
        </div>
        <Group title="Práce" items={active.filter((i) => i.kind === "work")} markupPct={company.materialMarkupPct}
          empty="Zatím žádné práce. Přidejte, co děláte nejčastěji – třeba nátěr za m²." />
        <Group title="Materiál" items={active.filter((i) => i.kind === "material")} markupPct={company.materialMarkupPct}
          empty="Zatím žádný materiál. Prodejní cena se dopočítá z vaší přirážky." />
        {hidden.length > 0 && (
          <details className="card">
            <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium text-muted">Skryté položky ({hidden.length})</summary>
            <div className="divide-y divide-line border-t border-line">
              {hidden.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="min-w-0 text-muted">
                    {i.name} <span className="text-[13px]">· {i.kind === "work" ? "práce" : "materiál"}</span>
                  </p>
                  <form action={setCatalogItemActive}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="active" value="true" />
                    <button className="btn-ghost min-h-9 px-3 text-[14px]">Vrátit do ceníku</button>
                  </form>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <aside>
        <AddItemForm markupPct={company.materialMarkupPct} />
      </aside>
    </div>
  );
}

function Group({ title, items, markupPct, empty }: { title: string; items: Item[]; markupPct: string; empty: string }) {
  return (
    <div>
      <h2 className="mb-2 font-display text-[17px] font-bold">{title}</h2>
      <div className="card divide-y divide-line">
        {items.length === 0 && <p className="px-4 py-6 text-center text-muted">{empty}</p>}
        {items.map((i) => (
          <details key={i.id} className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <p className="min-w-0 font-semibold">{i.name}</p>
              <p className="num text-[14px]">
                {i.kind === "material" && <span className="mr-2 text-muted">nákup {czk(i.purchase_price)}</span>}
                <span className="font-semibold">{czk(i.sale_price)}</span>
                <span className="text-muted"> / {i.unit}</span>
              </p>
            </summary>
            <div className="border-t border-line bg-paper/60 p-4">
              <form action={updateCatalogItem} className="space-y-3">
                <input type="hidden" name="id" value={i.id} />
                <ItemFields idPrefix={i.id} markupPct={markupPct} lockKind
                  initial={{ kind: i.kind, name: i.name, unit: i.unit, purchasePrice: toInput(toHundredths(i.purchase_price)), salePrice: toInput(toHundredths(i.sale_price)) }} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary">Uložit změny</button>
                </div>
              </form>
              <form action={setCatalogItemActive} className="mt-2">
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="active" value="false" />
                <button className="text-[13px] text-muted underline hover:text-warn">Skrýt z ceníku</button>
              </form>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
