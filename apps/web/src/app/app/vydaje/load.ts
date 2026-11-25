import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured } from "@/lib/ai/claude";
import type { JobOption } from "./ExpenseForm";

/** Zakázky pro výběr u výdaje a stav AI (zapnutá, kolik účtenek tento měsíc). */
export async function formContext(companyId: string) {
  const supabase = await createClient();
  const [{ data: jobs }, { data: quota }] = await Promise.all([
    supabase.from("jobs").select("id, number, title").eq("company_id", companyId).order("created_at", { ascending: false }).limit(200),
    supabase.rpc("ai_quota", { p_company: companyId }),
  ]);
  const q = (quota ?? {}) as { receipts_used?: number; receipts_limit?: number };
  return {
    jobs: (jobs ?? []).map((j): JobOption => ({ id: j.id, label: [j.number, j.title].filter(Boolean).join(" · ") })),
    ai: { enabled: aiConfigured(), used: q.receipts_used ?? 0, limit: q.receipts_limit ?? 0 },
  };
}
