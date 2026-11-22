import type { Metadata } from "next";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { addClient } from "./actions";

export const metadata: Metadata = { title: "Klienti" };

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
        <h1 className="mb-4 font-display text-[26px] font-extrabold">Klienti</h1>
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
                  {c.phone && <a className="text-accent" href={`tel:${c.phone}`}>{c.phone}</a>}
                  {c.email && <a className="text-accent" href={`mailto:${c.email}`}>{c.email}</a>}
                </div>
              </div>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-muted">Zatím žádní klienti. Přidejte prvního vpravo, nebo rovnou u zakázky.</p>
          )}
        </div>
      </section>

      <aside>
        <form action={addClient} className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Nový klient</h2>
          <div className="grid grid-cols-2 gap-2 text-[14px]">
            <label className="flex items-center gap-2"><input type="radio" name="kind" value="person" defaultChecked className="accent-accent" /> Osoba</label>
            <label className="flex items-center gap-2"><input type="radio" name="kind" value="company" className="accent-accent" /> Firma</label>
          </div>
          <div>
            <label className="label" htmlFor="c-name">Jméno nebo název</label>
            <input className="field" id="c-name" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="c-ico">IČO (u firmy)</label>
            <input className="field num" id="c-ico" name="ico" inputMode="numeric" maxLength={8} />
          </div>
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
            <input className="field" id="c-street" name="street" placeholder="Ulice a číslo" />
            <div className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2">
              <input className="field" name="city" placeholder="Obec" aria-label="Obec" />
              <input className="field num" name="zip" placeholder="PSČ" aria-label="PSČ" inputMode="numeric" />
            </div>
          </div>
          <label className="flex items-start gap-2 text-[13px] text-muted">
            <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-accent" />
            Klient souhlasí se zasíláním nabídek e-mailem
          </label>
          <button className="btn-primary w-full">Uložit klienta</button>
        </form>
      </aside>
    </div>
  );
}
