"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { czk, formatDate } from "@/lib/format";
import { decideOffer } from "./actions";

export interface CustomerOffer {
  id: string; firm: string; ico: string | null; city: string | null; web: string | null; professions: string[] | null;
  price: string; vat_note: "with_vat" | "non_payer"; start_date: string | null; duration: string | null; message: string;
  valid_until: string; status: "sent" | "accepted" | "declined"; created_at: string; phone: string | null; email: string | null;
}

/** Porovnání nabídek pro zákazníka: vedle sebe (na telefonu pod sebou), od nejlevnější. */
export function OfferCompare({ token, offers, open }: { token: string; offers: CustomerOffer[]; open: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const live = offers.filter((o) => o.status === "sent");
  const cheapest = live.length > 1 ? Math.min(...live.map((o) => Number(o.price))) : null;
  const accepted = offers.find((o) => o.status === "accepted");

  const decide = (o: CustomerOffer, d: "accept" | "decline") => {
    const q = d === "accept"
      ? `Vybrat nabídku firmy ${o.firm} za ${czk(o.price)}?\n\nFirma dostane váš kontakt, ostatním firmám dáme vědět a poptávka se uzavře.`
      : `Odmítnout nabídku firmy ${o.firm}?`;
    if (!confirm(q)) return;
    setError(null);
    start(async () => {
      const r = await decideOffer(token, o.id, d);
      if (!r.ok) setError(r.error ?? "Nepodařilo se uložit.");
      router.refresh();
    });
  };

  if (offers.length === 0) {
    return (
      <section id="nabidky" className="card scroll-mt-20 p-6 text-center" aria-labelledby="nabidky-h">
        <h2 id="nabidky-h" className="font-display text-[20px] font-extrabold">Nabídky</h2>
        <p className="mt-2 text-muted">Zatím žádná nabídka. Jakmile řemeslník nabídku pošle, dáme vám vědět e-mailem.</p>
      </section>
    );
  }

  return (
    <section id="nabidky" className="scroll-mt-20 space-y-3" aria-labelledby="nabidky-h">
      <div>
        <h2 id="nabidky-h" className="font-display text-[22px] font-extrabold">Nabídky ({offers.length})</h2>
        <p className="text-[14px] text-muted">
          {accepted ? <>Vybrali jste nabídku firmy <strong className="text-ink">{accepted.firm}</strong>. Firma vás bude kontaktovat.</>
            : open ? "Porovnejte cenu, termín i to, co je v ceně. Všechny firmy mají IČO ověřené v ARES." : "Poptávka je uzavřená."}
        </p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">{error}</p>}
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => {
          const isCheapest = cheapest !== null && Number(o.price) === cheapest && o.status === "sent";
          return (
            <li key={o.id} className={`card flex flex-col p-4 ${o.status === "accepted" ? "ring-2 ring-ok" : o.status === "declined" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap gap-1.5">
                {o.status === "accepted" && <span className="rounded-full bg-ok px-2 py-0.5 text-[12px] font-bold text-white">Vybraná</span>}
                {o.status === "declined" && <span className="rounded-full bg-paper px-2 py-0.5 text-[12px] font-semibold text-muted ring-1 ring-line">Odmítnutá</span>}
                {isCheapest && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-bold text-ok">Nejnižší cena</span>}
              </div>
              <p className="num mt-2 font-display text-[28px] font-extrabold leading-tight">{czk(o.price)}</p>
              <p className="text-[13px] text-muted">{o.vat_note === "with_vat" ? "včetně DPH" : "firma není plátce DPH"}</p>
              <dl className="mt-3 space-y-1 text-[14px]">
                <div className="flex justify-between gap-3"><dt className="text-muted">Začátek</dt><dd className="font-semibold">{o.start_date ? formatDate(o.start_date) : "dohodou"}</dd></div>
                {o.duration && <div className="flex justify-between gap-3"><dt className="text-muted">Doba práce</dt><dd className="font-semibold">{o.duration}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-muted">Platí do</dt><dd>{formatDate(o.valid_until)}</dd></div>
              </dl>
              <div className="mt-3 border-t border-line pt-3">
                <p className="font-semibold">{o.firm}</p>
                <p className="text-[13px] text-muted">{[o.ico && `IČO ${o.ico} ✓ ARES`, o.city].filter(Boolean).join(" · ")}</p>
                {o.professions && o.professions.length > 0 && <p className="text-[13px] text-muted">{o.professions.join(", ")}</p>}
                {o.web && <a href={/^https?:/.test(o.web) ? o.web : `https://${o.web}`} target="_blank" rel="noopener noreferrer nofollow" className="text-[13px] font-semibold text-accent-ink underline">Web firmy</a>}
              </div>
              <p className="mt-3 flex-1 whitespace-pre-line rounded-xl bg-paper p-3 text-[14px]">{o.message}</p>
              {o.status === "accepted" && (o.phone || o.email) && (
                <p className="mt-3 text-[14px]">
                  {o.phone && <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="num block font-semibold text-accent-ink underline">{o.phone}</a>}
                  {o.email && <a href={`mailto:${o.email}`} className="block break-all font-semibold text-accent-ink underline">{o.email}</a>}
                </p>
              )}
              {open && o.status === "sent" && !accepted && (
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-primary flex-1" disabled={pending} onClick={() => decide(o, "accept")}>Vybrat</button>
                  <button type="button" className="btn-ghost" disabled={pending} onClick={() => decide(o, "decline")}>Odmítnout</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
