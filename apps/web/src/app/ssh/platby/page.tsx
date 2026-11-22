import type { Metadata } from "next";
import Link from "next/link";
import { adminDate, requireAdmin, SUB_STATUS_LABELS } from "@/lib/admin";
import { czk } from "@/lib/format";
import { todayInPrague } from "@/lib/calendar";

export const metadata: Metadata = { title: "Platby" };

interface Billing {
  mrr: string; paying: number; received_30d: string; received_year: string;
  plans: { id: string; name: string; price_month: string; price_year: string; is_public: boolean; companies: number }[];
  due: { company_id: string; name: string; plan_id: string; status: string; period_end: string; read_only: boolean }[];
  recent: { company_id: string; name: string; paid_on: string; amount: string; plan_id: string; period_end: string }[];
}

export default async function AdminBilling() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_billing");
  if (error || !data) throw new Error("Platby se nepodařilo načíst.");
  const b = data as Billing;
  const today = todayInPrague();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-[26px] font-extrabold">Platby</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Měsíční příjem (MRR)" value={czk(b.mrr)} />
        <Kpi label="Platící firmy" value={String(b.paying)} />
        <Kpi label="Přijato za 30 dní" value={czk(b.received_30d)} />
        <Kpi label="Přijato letos" value={czk(b.received_year)} />
      </div>

      <section className="card" aria-labelledby="konci">
        <h2 id="konci" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Končí do 14 dní nebo po splatnosti</h2>
        {b.due.length ? (
          <ul className="divide-y divide-line text-[14px]">
            {b.due.map((d) => (
              <li key={d.company_id}>
                <Link href={`/ssh/firmy/${d.company_id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-paper">
                  <span className="font-semibold">{d.name}</span>
                  <span className={`num ${d.period_end < today ? "font-semibold text-warn" : "text-muted"}`}>
                    {d.period_end < today ? "skončilo" : "končí"} {adminDate(d.period_end)} · {SUB_STATUS_LABELS[d.status] ?? d.status}{d.read_only ? " · jen čtení" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="px-4 py-6 text-center text-muted">Nikomu předplatné nekončí.</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card" aria-labelledby="posledni">
          <h2 id="posledni" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Poslední platby</h2>
          {b.recent.length ? (
            <ul className="divide-y divide-line text-[14px]">
              {b.recent.map((r, i) => (
                <li key={i}>
                  <Link href={`/ssh/firmy/${r.company_id}`} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 hover:bg-paper">
                    <span><span className="font-semibold">{r.name}</span> <span className="text-muted">· {adminDate(r.paid_on)}</span></span>
                    <span className="num font-semibold">{czk(r.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-center text-muted">Zatím žádné platby. Zapisují se v detailu firmy.</p>}
        </section>
        <section className="card" aria-labelledby="tarify">
          <h2 id="tarify" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Tarify</h2>
          <ul className="divide-y divide-line text-[14px]">
            {b.plans.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span><span className="font-semibold">{p.name}</span>{!p.is_public && <span className="ml-2 text-[12px] text-muted">(skrytý)</span>}</span>
                <span className="num text-muted">{czk(p.price_month)}/měs. · {czk(p.price_year)}/rok · {p.companies} firem</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="text-[13px] text-muted">Ceny tarifů jsou bez DPH. Platby se zapisují ručně (převodem); napojení platební brány přijde později.</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="card px-4 py-3"><p className="text-[13px] text-muted">{label}</p><p className="num font-display text-[22px] font-extrabold">{value}</p></div>;
}
