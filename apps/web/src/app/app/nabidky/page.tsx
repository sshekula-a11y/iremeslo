import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { czk, formatDate } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/inquiries";

export const metadata: Metadata = { title: "Odeslané nabídky" };

interface Offer {
  id: string; inquiry_id: string; title: string; city: string; category: string; inquiry_status: string;
  price: string; vat_note: string; start_date: string | null; duration: string | null; status: "sent" | "accepted" | "declined";
  created_at: string; decided_at: string | null; valid_until: string;
  contact: { name: string; phone: string | null; email: string; street: string | null; city: string; zip: string | null } | null;
}

const STATUS = {
  sent: { label: "Čeká na zákazníka", cls: "bg-accent-soft text-ink" },
  accepted: { label: "Vybraná – ozvěte se", cls: "bg-ok text-white" },
  declined: { label: "Nevybraná", cls: "bg-paper text-muted ring-1 ring-line" },
} as const;

/** Nabídky, které firma poslala k poptávkám; u vybraných kontakt na zákazníka. */
export default async function OffersPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_offers", { p_company: company.id });
  const offers = (data ?? []) as Offer[];
  const won = offers.filter((o) => o.status === "accepted");
  const waiting = offers.filter((o) => o.status === "sent");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold">Odeslané nabídky</h1>
          <p className="text-[14px] text-muted">Nabídky k poptávkám zákazníků. Když vás zákazník vybere, uvidíte tu jeho kontakt.</p>
        </div>
        <Link href="/poptavky?moje=1" className="btn-primary">Najít poptávky</Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-[13px] text-muted">Odesláno</p><p className="num font-display text-[24px] font-extrabold">{offers.length}</p></div>
        <div className="card p-4"><p className="text-[13px] text-muted">Čeká</p><p className="num font-display text-[24px] font-extrabold">{waiting.length}</p></div>
        <div className="card p-4"><p className="text-[13px] text-muted">Vybráno</p><p className="num font-display text-[24px] font-extrabold text-ok">{won.length}</p></div>
      </div>

      {offers.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Zatím jste neposlali žádnou nabídku.</p>
          <p className="mt-1 text-[14px] text-muted">Otevřete poptávku ze svého oboru a dole vyplňte „Vaše nabídka“ – zákazník ji porovná s ostatními.</p>
          <Link href="/poptavky?moje=1" className="btn-primary mt-4 inline-flex">Poptávky z mých oborů</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {offers.map((o) => (
            <li key={o.id} className={`card p-4 ${o.status === "accepted" ? "ring-2 ring-ok" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/poptavky/${o.inquiry_id}`} className="font-semibold hover:underline">{o.title}</Link>
                  <p className="text-[13px] text-muted">{CATEGORY_LABEL[o.category] ?? o.category} · {o.city} · odesláno {formatDate(o.created_at.slice(0, 10))}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                  <p className="num mt-1 font-semibold">{czk(o.price)}</p>
                </div>
              </div>
              {o.contact && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ok-soft p-3">
                  <div className="text-[14px]">
                    <p className="font-semibold">{o.contact.name}</p>
                    <p className="text-muted">{[o.contact.street, o.contact.city].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.contact.phone && <a href={`tel:${o.contact.phone.replace(/\s/g, "")}`} className="btn-dark min-h-10 px-3 text-[14px]">Zavolat {o.contact.phone}</a>}
                    <a href={`mailto:${o.contact.email}?subject=${encodeURIComponent(`Vaše poptávka: ${o.title}`)}`} className="btn-ghost min-h-10 px-3 text-[14px]">Napsat e-mail</a>
                    <Link href={`/app/zakazky/nova?nabidka=${o.id}`} className="btn-primary min-h-10 px-3 text-[14px]">Založit zakázku</Link>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
