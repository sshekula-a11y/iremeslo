import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { buildInvoice, buildSpayd, kc, q, variableSymbol, type InvoiceSnapshot } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { loadParties } from "@/lib/documents/parties";
import { addDays, todayInPrague } from "@/lib/calendar";
import { ImageSlot } from "../ImageSlot";
import { ThemePicker } from "./ThemePicker";

export const metadata: Metadata = { title: "Vzhled faktury" };

export default async function InvoiceLookPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const [{ data: c }, parties] = await Promise.all([
    supabase.from("companies").select("invoice_theme, logo_path, stamp_path, signature_path, payment_terms_days").eq("id", company.id).single(),
    loadParties(company.id, null),
  ]);
  if (!c) throw new Error("Firmu se nepodařilo načíst.");

  const paths = [c.logo_path, c.stamp_path, c.signature_path].filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("files").createSignedUrls(paths, 60 * 60);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl);
  }
  const url = (p: string | null) => (p ? signed.get(p) ?? null : null);
  const canEdit = company.role === "owner";

  // Ukázková faktura s údaji firmy (dodavatel, účet) a vymyšleným odběratelem.
  const vatPayer = parties.vatPayer;
  const snapshot: InvoiceSnapshot = buildInvoice({
    title: "Malování bytu",
    supplier: parties.supplier,
    customer: { name: "Jana Ukázková", street: "Lipová 12", city: "Brno", zip: "602 00" },
    vatPayer,
    payment: parties.payment,
    job: {
      work: [{ description: "Malování stěn a stropů 2×", qty: q(85), unit: "m²", unitPrice: kc(95) }],
      materials: [{ description: "Penetrace a malířská barva", qtyPlanned: q(1), unit: "paušál", purchasePrice: kc(900), salePrice: kc(1200), billable: true }],
      labor: [], expenses: [],
      vatMode: vatPayer ? "standard" : "non_payer",
      vatRate: vatPayer ? (company.defaultVatRate === 12 ? 12 : 21) : 0,
    },
  });
  const today = todayInPrague();
  const number = `${today.slice(0, 4)}001`;
  const dueDate = addDays(today, c.payment_terms_days);
  let qrDataUrl: string | null = null;
  if (parties.payment?.iban) {
    try {
      qrDataUrl = await QRCode.toDataURL(buildSpayd({ iban: parties.payment.iban, amount: snapshot.amountDue, variableSymbol: variableSymbol(number), dueDate }), { margin: 0, width: 300 });
    } catch { /* neplatný účet – náhled bez QR */ }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/nastaveni" className="text-[14px] text-muted hover:text-ink">← Nastavení</Link>
        <h1 className="font-display text-[26px] font-extrabold">Vzhled faktury</h1>
        <p className="text-[14px] text-muted">Platí pro nabídky i faktury. {canEdit ? "Změny se ukládají hned." : "Měnit může jen majitel firmy."}</p>
      </div>
      {!parties.payment && (
        <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-[14px]">
          Bez bankovního účtu nebude na faktuře číslo účtu ani QR Platba.{" "}
          <Link href="/app/nastaveni" className="font-semibold text-accent-ink underline">Doplnit účet</Link>
        </p>
      )}
      <ThemePicker snapshot={snapshot} initialTheme={c.invoice_theme} canEdit={canEdit}
        meta={{ number, issueDate: today, validUntil: null, taxableDate: today, dueDate,
          logoUrl: url(c.logo_path), stampUrl: url(c.stamp_path), signatureUrl: url(c.signature_path), qrDataUrl }}>
        <section className="card space-y-3 p-4" aria-labelledby="obrazky">
          <h2 id="obrazky" className="font-display text-[17px] font-bold">Logo, razítko a podpis</h2>
          <p className="text-[13px] text-muted">
            Razítko s podpisem stačí vyfotit telefonem: orazítkujte a podepište bílý papír a vyfoťte ho zblízka.
            Bílé pozadí automaticky odstraníme.
          </p>
          <ImageSlot companyId={company.id} kind="logo" label="Logo" hint="Vlevo nahoře na dokladech" url={url(c.logo_path)} canEdit={canEdit} />
          <ImageSlot companyId={company.id} kind="stamp" label="Razítko s podpisem" hint="Vyfoťte razítko i s podpisem najednou" url={url(c.stamp_path)} canEdit={canEdit} />
          <ImageSlot companyId={company.id} kind="signature" label="Jen podpis" hint="Když razítko nepoužíváte" url={url(c.signature_path)} canEdit={canEdit} />
        </section>
      </ThemePicker>
    </div>
  );
}
