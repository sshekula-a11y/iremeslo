import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ImportInvoices } from "./ImportInvoices";

export const metadata: Metadata = { title: "Převzít faktury z jiného programu" };

export default async function ImportInvoicesPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data: c } = await supabase.from("companies").select("read_only").eq("id", company.id).single();
  return (
    <div className="space-y-5">
      <Link href="/app/faktury" className="text-[14px] text-muted hover:text-ink">← Faktury</Link>
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Převzít faktury z jiného programu</h1>
        <p className="text-[14px] text-muted">
          Faktury vystavené jinde (FakturaOnline, Fakturoid, iDoklad, Pohoda…) uložíme jako archiv s PDF. Nemění vaši číselnou řadu v iRemeslo.
          Odběratele přiřadíme k zákazníkům, nové zákazníky založíme.
        </p>
      </div>
      <ImportInvoices canWrite={!c?.read_only} />
    </div>
  );
}
