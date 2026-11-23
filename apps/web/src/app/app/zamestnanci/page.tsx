import type { Metadata } from "next";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { czk } from "@/lib/format";
import { addEmployee } from "./actions";

export const metadata: Metadata = { title: "Zaměstnanci" };

export default async function EmployeesPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, phone, rate_hour, rate_day, active")
    .eq("company_id", company.id)
    .order("name");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <section>
        <h1 className="mb-1 font-display text-[26px] font-extrabold">Zaměstnanci</h1>
        <p className="mb-4 text-[14px] text-muted">Nákladové sazby se předvyplní v zakázce a jdou tam přepsat.</p>
        <div className="card divide-y divide-line">
          {employees && employees.length > 0 ? (
            employees.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-semibold">{e.name}</p>
                  {e.phone && <a className="text-[13px] text-accent-ink" href={`tel:${e.phone}`}>{e.phone}</a>}
                </div>
                <p className="num text-[14px] text-muted">
                  {czk(e.rate_hour)} / hod · {czk(e.rate_day)} / den
                </p>
              </div>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-muted">Přidejte sebe i kolegy – bez nich nejde spočítat náklady na zaměstnance.</p>
          )}
        </div>
      </section>
      <aside>
        <form action={addEmployee} className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Přidat zaměstnance</h2>
          <div>
            <label className="label" htmlFor="e-name">Jméno</label>
            <input className="field" id="e-name" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="e-phone">Telefon</label>
            <input className="field" id="e-phone" name="phone" type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="e-hour">Kč / hod</label>
              <input className="field num" id="e-hour" name="rate_hour" inputMode="decimal" />
            </div>
            <div>
              <label className="label" htmlFor="e-day">Kč / den</label>
              <input className="field num" id="e-day" name="rate_day" inputMode="decimal" />
            </div>
          </div>
          <button className="btn-primary w-full">Přidat zaměstnance</button>
        </form>
      </aside>
    </div>
  );
}
