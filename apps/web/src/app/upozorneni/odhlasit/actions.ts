"use server";

import { createClient } from "@/lib/supabase/server";

export type UnsubState = { done?: boolean; firm?: string | null; error?: string };

export async function unsubscribe(_: UnsubState, form: FormData): Promise<UnsubState> {
  const token = String(form.get("t") ?? "");
  if (!/^[0-9a-f]{36}$/.test(token)) return { error: "Odkaz je neplatný." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alerts_unsubscribe", { p_token: token });
  if (error) return { error: "Odhlášení se nepodařilo. Zkuste to prosím znovu." };
  if (!data) return { error: "Odkaz je neplatný nebo už nepatří žádné firmě." };
  return { done: true, firm: data as string };
}
