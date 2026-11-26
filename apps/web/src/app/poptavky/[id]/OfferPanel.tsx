"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { czk, formatDate } from "@/lib/format";
import { sendOffer, withdrawOffer } from "./offer-actions";

export interface MyOffer { id: string; price: string; start_date: string | null; duration: string | null; message: string; valid_until: string; status: "sent" | "accepted" | "declined" | "withdrawn" }

const STATUS: Record<MyOffer["status"], { label: string; cls: string }> = {
  sent: { label: "Odesláno – čeká na zákazníka", cls: "bg-accent-soft text-ink" },
  accepted: { label: "Zákazník vybral vaši nabídku", cls: "bg-ok-soft text-ok" },
  declined: { label: "Zákazník vybral jinou nabídku", cls: "bg-paper text-muted" },
  withdrawn: { label: "Nabídku jste stáhli", cls: "bg-paper text-muted" },
};

/** Nabídka řemeslníka k poptávce: poslat, upravit, stáhnout. Zákazník nabídky porovná a jednu vybere. */
export function OfferPanel({ inquiryId, offer, count, vatPayer, today }: { inquiryId: string; offer: MyOffer | null; count: number; vatPayer: boolean; today: string }) {
  const router = useRouter();
  const editable = !offer || offer.status === "sent" || offer.status === "withdrawn";
  const [editing, setEditing] = useState(!offer || offer.status === "withdrawn");
  const [f, setF] = useState({
    price: offer ? String(Number(offer.price)).replace(".", ",") : "",
    start: offer?.start_date ?? "", duration: offer?.duration ?? "", message: offer?.message ?? "", validDays: "14",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    setError(null); setDone(null);
    start(async () => {
      const r = await sendOffer(inquiryId, f);
      if (!r.ok) { setError(r.error); return; }
      setDone(r.isNew ? "Nabídka odeslána. Zákazníkovi jsme poslali e-mail – až si vybere, dáme vám vědět." : "Nabídka upravena.");
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="nabidka">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="nabidka" className="font-display text-[20px] font-extrabold">Vaše nabídka</h2>
        <span className="text-[13px] text-muted">{count === 0 ? "Zatím žádná nabídka – buďte první" : `Nabídek k poptávce: ${count}`}</span>
      </div>

      {done && <p role="status" className="mt-3 rounded-xl bg-ok-soft px-3 py-2.5 text-[14px] text-ok">{done}</p>}

      {offer && !editing && (
        <div className="mt-3 space-y-2">
          <p className={`inline-block rounded-full px-3 py-1 text-[13px] font-semibold ${STATUS[offer.status].cls}`}>{STATUS[offer.status].label}</p>
          <p className="num font-display text-[26px] font-extrabold">{czk(offer.price)} <span className="text-[14px] font-normal text-muted">{vatPayer ? "vč. DPH" : "neplátce DPH"}</span></p>
          <p className="text-[14px] text-muted">
            {offer.start_date ? <>Začátek {formatDate(offer.start_date)}</> : "Začátek dohodou"}{offer.duration ? ` · ${offer.duration}` : ""} · platí do {formatDate(offer.valid_until)}
          </p>
          <p className="whitespace-pre-line rounded-xl bg-paper p-3 text-[15px]">{offer.message}</p>
          {offer.status === "accepted" && <Link href="/app/nabidky" className="btn-primary">Zobrazit kontakt na zákazníka</Link>}
          {offer.status === "sent" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>Upravit nabídku</button>
              <button type="button" className="text-[14px] font-semibold text-warn hover:underline" disabled={pending}
                onClick={() => { if (confirm("Opravdu stáhnout nabídku? Zákazník ji přestane vidět.")) start(async () => { await withdrawOffer(inquiryId, offer.id); setEditing(true); router.refresh(); }); }}>
                Stáhnout nabídku
              </button>
            </div>
          )}
        </div>
      )}

      {editable && editing && (
        <div className="mt-3 space-y-3">
          <p className="text-[14px] text-muted">Zákazník nabídky porovná vedle sebe a jednu vybere. Vybraná firma dostane jeho kontakt e-mailem.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="o-price">Cena celkem ({vatPayer ? "vč. DPH" : "neplátce DPH"})</label>
              <div className="relative">
                <input id="o-price" className="field num pr-10" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="např. 18 500" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">Kč</span>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="o-start">Můžu začít</label>
              <input id="o-start" type="date" className="field" min={today} value={f.start} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="o-duration">Jak dlouho to potrvá</label>
              <input id="o-duration" className="field" maxLength={80} value={f.duration} onChange={(e) => set("duration", e.target.value)} placeholder="např. 3 dny" />
            </div>
            <div>
              <label className="label" htmlFor="o-valid">Nabídka platí</label>
              <select id="o-valid" className="field" value={f.validDays} onChange={(e) => set("validDays", e.target.value)}>
                <option value="7">7 dní</option><option value="14">14 dní</option><option value="30">30 dní</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="o-msg">Zpráva zákazníkovi</label>
            <textarea id="o-msg" className="field min-h-28" maxLength={2000} value={f.message} onChange={(e) => set("message", e.target.value)}
              placeholder="Co je v ceně (materiál, doprava, úklid), jak budete postupovat, záruka…" />
            <p className="mt-1 text-right text-[12px] text-muted">{f.message.length} / 2000</p>
          </div>
          {error && <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={pending} onClick={submit}>{pending ? "Odesílám…" : offer && offer.status === "sent" ? "Uložit změny" : "Poslat nabídku"}</button>
            {offer && offer.status === "sent" && <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Zrušit</button>}
          </div>
        </div>
      )}
    </section>
  );
}
