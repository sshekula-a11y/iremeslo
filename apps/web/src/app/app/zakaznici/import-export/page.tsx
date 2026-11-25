import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ImportExport } from "./ImportExport";

export const metadata: Metadata = { title: "Import a export zákazníků" };

export default async function ClientsImportExportPage() {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data: c } = await supabase.from("companies").select("read_only").eq("id", company.id).single();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/app/zakaznici" className="text-[14px] text-muted hover:text-ink">← Zákazníci</Link>
      <h1 className="font-display text-[26px] font-extrabold">Import a export zákazníků</h1>
      <ImportExport canWrite={!c?.read_only} />
    </div>
  );
}
