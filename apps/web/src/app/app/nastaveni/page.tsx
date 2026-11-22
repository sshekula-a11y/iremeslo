import type { Metadata } from "next";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { toHundredths, toInput } from "@/lib/money";
import { ROLE_LABELS } from "@/lib/labels";
import { SettingsForm } from "./SettingsForm";
import { ImageSlot } from "./ImageSlot";

export const metadata: Metadata = { title: "Nastavení firmy" };

export default async function SettingsPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("companies")
    .select("name, ico, dic, street, city, zip, email, phone, web, register_entry, bank_account, iban, bic, vat_payer, default_vat_rate, payment_terms_days, material_markup_pct, min_margin_pct, invoice_theme, logo_path, stamp_path, signature_path")
    .eq("id", company.id)
    .single();
  if (!c) throw new Error("Firmu se nepodařilo načíst.");

  const paths = [c.logo_path, c.stamp_path, c.signature_path].filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("files").createSignedUrls(paths, 60 * 60);
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  const url = (p: string | null) => (p ? urls.get(p) ?? null : null);
  const canEdit = company.role === "owner";
  const pct = (v: string | number) => toInput(toHundredths(v)) || "0";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Nastavení firmy</h1>
        <p className="text-[14px] text-muted">Vaše role: {ROLE_LABELS[company.role]}. Změny platí pro nové doklady, vystavené zůstávají beze změny.</p>
      </div>

      <SettingsForm canEdit={canEdit} initial={{
        name: c.name, ico: c.ico ?? "", dic: c.dic ?? "", street: c.street ?? "", city: c.city ?? "", zip: c.zip ?? "",
        email: c.email ?? "", phone: c.phone ?? "", web: c.web ?? "", registerEntry: c.register_entry ?? "",
        bankAccount: c.bank_account ?? "", iban: c.bank_account ? "" : c.iban ?? "", bic: c.bic ?? "",
        vatPayer: c.vat_payer, defaultVatRate: c.default_vat_rate === 12 ? "12" : "21", paymentTermsDays: String(c.payment_terms_days),
        markupPct: pct(c.material_markup_pct), minMarginPct: pct(c.min_margin_pct), theme: c.invoice_theme,
      }} />

      <section className="card p-4">
        <h2 className="font-display text-[17px] font-bold">Logo, razítko a podpis</h2>
        <p className="text-[13px] text-muted">
          Razítko s podpisem stačí vyfotit telefonem: orazítkujte a podepište bílý papír a vyfoťte ho zblízka, bez stínu.
          Bílý papír odstraníme, na faktuře bude jen razítko a podpis.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ImageSlot companyId={company.id} kind="logo" label="Logo" hint="Vlevo nahoře na dokladech" url={url(c.logo_path)} canEdit={canEdit} />
          <ImageSlot companyId={company.id} kind="stamp" label="Razítko s podpisem" hint="Vyfoťte razítko i s podpisem najednou" url={url(c.stamp_path)} canEdit={canEdit} />
          <ImageSlot companyId={company.id} kind="signature" label="Jen podpis" hint="Když razítko nepoužíváte" url={url(c.signature_path)} canEdit={canEdit} />
        </div>
      </section>
    </div>
  );
}
