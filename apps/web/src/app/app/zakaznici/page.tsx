import type { Metadata } from "next";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { addClient } from "./actions";
import { NewClientFields } from "./NewClientFields";

export const metadata: Metadata = { title: "Zákazníci" };

export default async function ClientsPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, kind, name, ico, email, phone, city")
    .eq("company_id", company.id)
    .order("name");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <section>
        <h1 className="mb-4 font-display text-[26px] font-extrabold">Zákazníci</h1>
        <div className="card divide-y divide-line">
          {clients && clients.length > 0 ? (
            clients.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-[13px] text-muted">
                    {[c.kind === "company" ? (c.ico ? `IČO ${c.ico}` : "Firma") : "Osoba", c.city].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex gap-3 text-[14px]">
                  {c.phone && <a className="text-accent-ink" href={`tel:${c.phone}`}>{c.phone}</a>}
                  {c.email && <a className="text-accent-ink" href={`mailto:${c.email}`}>{c.email}</a>}
                </div>
              </div>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-muted">Zatím žádní zákazníci. Přidejte prvního vpravo, nebo rovnou u zakázky.</p>
          )}
        </div>
      </section>

      <aside>
        <form action={addClient} className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Nový zákazník</h2>
          <NewClientFields />
          <label className="flex items-start gap-2 text-[13px] text-muted">
            <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-accent" />
            Zákazník souhlasí se zasíláním nabídek e-mailem
          </label>
          <button className="btn-primary w-full">Uložit zákazníka</button>
        </form>
      </aside>
    </div>
  );
}
