import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { toHundredths, toInput } from "@/lib/money";
import { ROLE_LABELS } from "@/lib/labels";
import { SettingsForm } from "./SettingsForm";
import { ProfessionPicker } from "./ProfessionPicker";
import { byCzechName } from "@/lib/professions";

export const metadata: Metadata = { title: "Nastavení firmy" };

export default async function SettingsPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("companies")
    .select("name, ico, ico_verified_at, ares_name, dic, street, city, zip, email, phone, web, register_entry, bank_account, iban, bic, vat_payer, default_vat_rate, payment_terms_days, material_markup_pct, min_margin_pct")
    .eq("id", company.id)
    .single();
  if (!c) throw new Error("Firmu se nepodařilo načíst.");
  const [{ data: profs }, { data: mine }] = await Promise.all([
    supabase.from("professions").select("slug, name"),
    supabase.from("company_professions").select("profession_slug").eq("company_id", company.id),
  ]);

  const canEdit = company.role === "owner";
  const pct = (v: string | number) => toInput(toHundredths(v)) || "0";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Nastavení firmy</h1>
        <p className="text-[14px] text-muted">Vaše role: {ROLE_LABELS[company.role]}. Změny platí pro nové doklady, vystavené zůstávají beze změny.</p>
      </div>

      {c.ico_verified_at ? (
        <p className="rounded-xl bg-ok-soft px-4 py-3 text-[14px] text-ok">
          <strong>IČO {c.ico} je ověřené v ARES</strong>{c.ares_name ? ` (${c.ares_name})` : ""}. Vidíte kontakty na zadavatele poptávek.
        </p>
      ) : (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn">
          <strong>IČO {c.ico} zatím není ověřené v ARES.</strong> Ověření běží automaticky a obvykle trvá do dvou minut.
          Pokud se nedaří, zkontrolujte IČO níže nebo napište na <a className="underline" href="mailto:info@iremeslo.cz">info@iremeslo.cz</a>.
        </p>
      )}

      <ProfessionPicker
        options={((profs ?? []) as { slug: string; name: string }[]).sort(byCzechName)}
        initial={((mine ?? []) as { profession_slug: string }[]).map((m) => m.profession_slug)}
        canEdit={canEdit}
      />

      <Link href="/app/nastaveni/faktura" className="card flex items-center justify-between gap-3 p-4 hover:border-ink/30">
        <span>
          <span className="block font-display text-[17px] font-bold">Vzhled faktury</span>
          <span className="block text-[14px] text-muted">Barva, logo, razítko a podpis – s náhledem faktury</span>
        </span>
        <span className="text-[20px] text-accent-ink" aria-hidden="true">→</span>
      </Link>

      <SettingsForm canEdit={canEdit} initial={{
        name: c.name, ico: c.ico ?? "", dic: c.dic ?? "", street: c.street ?? "", city: c.city ?? "", zip: c.zip ?? "",
        email: c.email ?? "", phone: c.phone ?? "", web: c.web ?? "", registerEntry: c.register_entry ?? "",
        bankAccount: c.bank_account ?? "", iban: c.bank_account ? "" : c.iban ?? "", bic: c.bic ?? "",
        vatPayer: c.vat_payer, defaultVatRate: c.default_vat_rate === 12 ? "12" : "21", paymentTermsDays: String(c.payment_terms_days),
        markupPct: pct(c.material_markup_pct), minMarginPct: pct(c.min_margin_pct),
      }} />
    </div>
  );
}
