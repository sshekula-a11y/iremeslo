"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function saveTaxProfile(form: FormData): Promise<void> {
  const company = await requireStaff();
  const legal = String(form.get("legal_form"));
  const rate = Number(form.get("flat_rate"));
  const regime = String(form.get("regime"));
  if (!["osvc", "po"].includes(legal) || ![80, 60, 40].includes(rate) || !["actual", "flat_expenses", "flat_tax"].includes(regime)) return;
  const supabase = await createClient();
  await supabase.from("tax_profiles").upsert({ company_id: company.id, legal_form: legal, flat_rate: rate, regime, updated_at: new Date().toISOString() });
  revalidatePath("/app/ucetni");
}
