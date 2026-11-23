import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { todayInPrague } from "@/lib/calendar";
import { QuickInvoiceForm } from "./QuickInvoiceForm";

export const metadata: Metadata = { title: "Nová faktura" };

/** Rychlá faktura: odběratel a položky na jedné obrazovce, bez zakládání zakázky. */
export default async function QuickInvoicePage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const [{ data: clients }, { data: catalog }, { data: firm }, { data: emailStatus }] = await Promise.all([
    supabase.from("clients").select("id, name, ico").eq("company_id", company.id).order("name"),
    supabase.from("catalog_items").select("name, unit, sale_price").eq("company_id", company.id).eq("active", true).order("name"),
    supabase.from("companies").select("iban, bank_account").eq("id", company.id).single(),
    supabase.rpc("my_email_status"),
  ]);
  const unverified = (emailStatus as { verified?: boolean } | null)?.verified === false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/app/faktury" className="text-[14px] text-muted hover:text-ink">← Faktury</Link>
          <h1 className="font-display text-[26px] font-extrabold">Nová faktura</h1>
        </div>
        <Link href="/app/faktury/nova" className="text-[14px] font-semibold text-accent-ink hover:underline">Vyfakturovat existující zakázku →</Link>
      </div>
      {unverified && (
        <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn" role="alert">
          <strong>Nejdřív potvrďte e-mail.</strong> Fakturu můžete vyplnit, ale vystavit ji půjde až po kliknutí na odkaz z e-mailu.
        </p>
      )}
      {!firm?.iban && !firm?.bank_account && (
        <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-[14px]">
          Na faktuře zatím nebude číslo účtu ani QR Platba.{" "}
          <Link href="/app/nastaveni" className="font-semibold text-accent-ink underline">Doplňte účet v nastavení</Link>.
        </p>
      )}
      <QuickInvoiceForm
        clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name, ico: c.ico }))}
        catalog={(catalog ?? []).map((c) => ({ name: c.name, unit: c.unit, price: String(c.sale_price) }))}
        vatPayer={company.vatPayer}
        defaultVatRate={company.defaultVatRate === 12 ? 12 : 21}
        today={todayInPrague()}
      />
    </div>
  );
}
