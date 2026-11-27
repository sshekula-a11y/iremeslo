import type { Metadata } from "next";
import { requireStaff, type ActiveCompany } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../JobForm";
import { emptyDraft, loadOptions } from "../load";
import type { JobDraft } from "../types";

export const metadata: Metadata = { title: "Nová zakázka" };

interface AcceptedOffer {
  id: string; title: string; description: string; quantity: number | null; unit: string | null; status: string;
  price: number; vat_note: "with_vat" | "non_payer"; start_date: string | null;
  contact: { name: string; phone: string | null; email: string; street: string | null; city: string; zip: string | null } | null;
}

const UNIT: Record<string, string> = { m2: "m²", bm: "bm", ks: "ks", hod: "hod" };
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Zakázka předvyplněná z vybrané nabídky: zákazník, místo, termín a cena (bez DPH, pokud je firma plátce). */
async function draftFromOffer(company: ActiveCompany, offerId: string): Promise<JobDraft | null> {
  if (!/^[0-9a-f-]{36}$/.test(offerId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_offers", { p_company: company.id });
  const o = ((data ?? []) as AcceptedOffer[]).find((x) => x.id === offerId && x.status === "accepted" && x.contact);
  if (!o?.contact) return null;
  const d = emptyDraft(company);
  const net = company.vatPayer && o.vat_note === "with_vat" && d.vatRate ? o.price / (1 + d.vatRate / 100) : Number(o.price);
  const qty = o.quantity && o.unit && UNIT[o.unit] ? Number(o.quantity) : null;
  return {
    ...d,
    title: o.title,
    status: "approved",
    newClientName: o.contact.name,
    newClientPhone: o.contact.phone ?? "",
    siteAddress: [o.contact.street, [o.contact.zip, o.contact.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    dateFrom: o.start_date ?? "",
    note: `Z poptávky na iRemeslo.cz. E-mail zákazníka: ${o.contact.email}.`,
    // Jednotkovou cenu použijeme, jen když součet vyjde na haléř přesně – jinak paušál s výměrou v popisu.
    work: [qty && Math.abs(round2(round2(net / qty) * qty) - round2(net)) < 0.005
      ? { key: "w0", description: o.title, qty: String(qty), unit: UNIT[o.unit!], unitPrice: String(round2(net / qty)) }
      : { key: "w0", description: qty ? `${o.title} (${qty.toLocaleString("cs-CZ")} ${UNIT[o.unit!]})` : o.title, qty: "1", unit: "paušál", unitPrice: String(round2(net)) }],
  };
}

export default async function NewJobPage({ searchParams }: PageProps<"/app/zakazky/nova">) {
  const company = await requireStaff();
  const { clients, employees, catalog } = await loadOptions(company.id);
  const offer = (await searchParams).nabidka;
  const fromOffer = typeof offer === "string" ? await draftFromOffer(company, offer) : null;
  return (
    <>
      <h1 className="mb-4 font-display text-[26px] font-extrabold">Nová zakázka</h1>
      {fromOffer && (
        <p className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-[14px] text-ok" role="status">
          Předvyplněno z vybrané nabídky: zákazník, místo, termín a cena. Doplňte materiál a lidi – uvidíte náklady a zisk.
        </p>
      )}
      <JobForm initial={fromOffer ?? emptyDraft(company)} clients={clients} employees={employees} catalog={catalog} markupPct={company.materialMarkupPct} minMarginPct={company.minMarginPct} />
    </>
  );
}
