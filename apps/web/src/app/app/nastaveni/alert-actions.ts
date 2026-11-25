"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { REGIONS } from "@/lib/inquiries";

const REGION_IDS = new Set<string>(REGIONS.map(([id]) => id));

export async function saveAlertSettings(s: { enabled: boolean; frequency: string; regions: string[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await requireStaff();
  if (company.role !== "owner") return { ok: false, error: "Upozornění může měnit majitel firmy." };
  if (!["instant", "daily"].includes(s.frequency)) return { ok: false, error: "Neplatná frekvence." };
  const regions = [...new Set((s.regions ?? []).filter((r) => REGION_IDS.has(r)))];
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_alert_settings", { p_company: company.id, p_enabled: !!s.enabled, p_frequency: s.frequency, p_regions: regions });
  if (error) return { ok: false, error: error.message.includes("jen pro čtení") ? "Účet je v režimu jen pro čtení." : "Nastavení se nepodařilo uložit." };
  revalidatePath("/app/nastaveni");
  return { ok: true };
}
