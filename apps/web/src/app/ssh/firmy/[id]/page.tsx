import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTION_LABELS, adminDate, requireAdmin, SUB_STATUS_LABELS } from "@/lib/admin";
import { czk } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";
import { todayInPrague } from "@/lib/calendar";
import { ActionForm } from "../../ActionForm";
import { recordPayment, setReadOnly, setSubscription } from "../../actions";
import { BanForm } from "../../BanForm";

export const metadata: Metadata = { title: "Firma" };

interface Detail {
  company: { id: string; name: string; ico: string | null; dic: string | null; city: string | null; email: string | null; phone: string | null; vat_payer: boolean; read_only: boolean; created_at: string };
  subscription: { plan_id: string; status: string; period_start: string; period_end: string | null; billing_interval: string | null } | null;
  members: { user_id: string; email: string; role: "owner" | "office" | "worker"; last_sign_in_at: string | null; banned: boolean }[];
  counts: { jobs: number; clients: number; quotes: number; invoices: number };
  payments: { paid_on: string; amount: string; plan_id: string; billing_interval: string; period_start: string; period_end: string; note: string | null }[];
  actions: { at: string; action: string; detail: Record<string, unknown> }[];
}

export default async function AdminCompany({ params }: PageProps<"/ssh/firmy/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data, error }, { data: plans }] = await Promise.all([
    supabase.rpc("admin_company", { p_company: id }),
    supabase.from("plans").select("id, name, price_month, price_year").order("sort"),
  ]);
  if (error || !data) notFound();
  const d = data as Detail;
  const c = d.company;
  const sub = d.subscription;
  const paidPlans = (plans ?? []).filter((p) => p.id !== "beta");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/ssh/firmy" className="text-[14px] text-muted hover:text-ink">← Firmy</Link>
        <h1 className="font-display text-[26px] font-extrabold">{c.name}</h1>
        <p className="text-[14px] text-muted">
          {[c.ico && `IČO ${c.ico}`, c.dic && `DIČ ${c.dic}`, c.vat_payer ? "plátce DPH" : "neplátce", c.city, c.email, c.phone, `registrace ${adminDate(c.created_at)}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Zakázky", d.counts.jobs], ["Zákazníci", d.counts.clients], ["Nabídky", d.counts.quotes], ["Faktury", d.counts.invoices]] as const).map(([l, n]) => (
          <div key={l} className="card px-4 py-3"><p className="text-[13px] text-muted">{l}</p><p className="num font-display text-[22px] font-extrabold">{n}</p></div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-4 p-4" aria-labelledby="tarif">
          <div>
            <h2 id="tarif" className="font-display text-[17px] font-bold">Tarif</h2>
            <p className="text-[14px] text-muted">
              {sub ? <>{(plans ?? []).find((p) => p.id === sub.plan_id)?.name ?? sub.plan_id} · {SUB_STATUS_LABELS[sub.status] ?? sub.status}
                {sub.period_end && <> · do {adminDate(sub.period_end)}</>}{sub.billing_interval && <> · {sub.billing_interval === "year" ? "ročně" : "měsíčně"}</>}</> : "Bez předplatného"}
              {c.read_only && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[12px] font-semibold text-warn">jen pro čtení</span>}
            </p>
          </div>
          <ActionForm action={setSubscription} submit="Uložit tarif">
            <input type="hidden" name="company" value={c.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Select name="plan" label="Tarif" defaultValue={sub?.plan_id ?? "beta"} options={(plans ?? []).map((p) => [p.id, p.name])} />
              <Select name="status" label="Stav" defaultValue={sub?.status === "read_only" ? "active" : sub?.status ?? "active"}
                options={[["active", "Aktivní"], ["trialing", "Zkušební"], ["past_due", "Po splatnosti"], ["canceled", "Zrušené"]]} />
              <Field name="period_end" label="Platí do" type="date" defaultValue={sub?.period_end ?? ""} />
              <Select name="interval" label="Období" defaultValue={sub?.billing_interval ?? ""} options={[["", "—"], ["month", "Měsíčně"], ["year", "Ročně"]]} />
            </div>
            <Field name="note" label="Poznámka" placeholder="např. sleva pro první zákazníky" />
          </ActionForm>
        </section>

        <section className="card space-y-4 p-4" aria-labelledby="platba">
          <div>
            <h2 id="platba" className="font-display text-[17px] font-bold">Zapsat platbu</h2>
            <p className="text-[14px] text-muted">Platba převodem prodlouží předplatné o měsíc nebo rok a zruší režim jen pro čtení.</p>
          </div>
          <ActionForm action={recordPayment} submit="Zapsat platbu" tone="primary">
            <input type="hidden" name="company" value={c.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Select name="plan" label="Tarif" defaultValue={sub && sub.plan_id !== "beta" ? sub.plan_id : paidPlans[0]?.id ?? ""}
                options={paidPlans.map((p) => [p.id, `${p.name.replace(/ \(.*\)$/, "")} · ${czk(p.price_month)} / ${czk(p.price_year)}`])} />
              <Select name="interval" label="Období" defaultValue={sub?.billing_interval ?? "month"} options={[["month", "Měsíc"], ["year", "Rok"]]} />
              <Field name="amount" label="Částka (Kč)" inputMode="decimal" required placeholder="199" />
              <Field name="paid_on" label="Zaplaceno dne" type="date" defaultValue={todayInPrague()} max={todayInPrague()} required />
            </div>
            <Field name="note" label="Poznámka" placeholder="např. VS nebo číslo faktury" />
          </ActionForm>
        </section>
      </div>

      <section className="card space-y-3 p-4" aria-labelledby="ro">
        <h2 id="ro" className="font-display text-[17px] font-bold">Režim jen pro čtení</h2>
        <p className="text-[14px] text-muted">Firma uvidí svá data, ale nebude moct nic měnit ani vystavovat. Použijte při neplacení.</p>
        <ActionForm action={setReadOnly} submit={c.read_only ? "Vypnout režim jen pro čtení" : "Zapnout režim jen pro čtení"} tone={c.read_only ? "dark" : "danger"}>
          <input type="hidden" name="company" value={c.id} />
          <input type="hidden" name="value" value={c.read_only ? "false" : "true"} />
          <Field name="reason" label="Důvod (uloží se do záznamu)" required placeholder={c.read_only ? "např. doplaceno" : "např. 2 měsíce nezaplaceno"} />
        </ActionForm>
      </section>

      <section className="card" aria-labelledby="lide">
        <h2 id="lide" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Uživatelé firmy</h2>
        <ul className="divide-y divide-line">
          {d.members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold">{m.email} {m.banned && <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">zablokovaný</span>}</p>
                <p className="text-[13px] text-muted">{ROLE_LABELS[m.role]} · poslední přihlášení {adminDate(m.last_sign_in_at, true)}</p>
              </div>
              <BanForm userId={m.user_id} banned={m.banned} companyId={c.id} />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card" aria-labelledby="platby">
          <h2 id="platby" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Platby předplatného</h2>
          {d.payments.length ? (
            <ul className="divide-y divide-line text-[14px]">
              {d.payments.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                  <span><span className="num font-semibold">{czk(p.amount)}</span> · {adminDate(p.paid_on)}{p.note && <span className="text-muted"> · {p.note}</span>}</span>
                  <span className="num text-muted">{adminDate(p.period_start)} – {adminDate(p.period_end)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-center text-muted">Zatím žádné platby.</p>}
        </section>
        <section className="card" aria-labelledby="zaznam">
          <h2 id="zaznam" className="border-b border-line px-4 py-3 font-display text-[17px] font-bold">Záznam zásahů</h2>
          {d.actions.length ? (
            <ul className="divide-y divide-line text-[14px]">
              {d.actions.map((a, i) => (
                <li key={i} className="px-4 py-2.5">
                  <span className="font-semibold">{ACTION_LABELS[a.action] ?? a.action}</span>
                  {typeof a.detail.reason === "string" && <span className="text-muted"> – {a.detail.reason}</span>}
                  {typeof a.detail.note === "string" && a.detail.note && <span className="text-muted"> – {a.detail.note}</span>}
                  <span className="block text-[12px] text-muted">{adminDate(a.at, true)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-center text-muted">Bez zásahů.</p>}
        </section>
      </div>
    </div>
  );
}

function Field({ name, label, ...rest }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} className="field" {...rest} />
    </div>
  );
}

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: (readonly [string, string])[] | [string, string][]; defaultValue: string }) {
  return (
    <div>
      <label className="label" htmlFor={`s-${name}`}>{label}</label>
      <select id={`s-${name}`} name={name} className="field" defaultValue={defaultValue}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
