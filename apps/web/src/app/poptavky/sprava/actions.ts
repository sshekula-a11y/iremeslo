"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Zadavatel uzavře poptávku odkazem z e-mailu (token je jediné ověření). */
export async function closeInquiry(form: FormData) {
  const token = String(form.get("t") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) redirect("/poptavky");
  const supabase = await createClient();
  await supabase.rpc("close_inquiry", { p_token: token });
  redirect(`/poptavky/sprava?t=${token}&uzavreno=1`);
}

/** Zadavatel vybere nebo odmítne nabídku (token z e-mailu je jediné ověření). */
export async function decideOffer(token: string, offerId: string, decision: "accept" | "decline"): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-f]{64}$/.test(token) || !/^[0-9a-f-]{36}$/.test(offerId) || !["accept", "decline"].includes(decision)) return { ok: false, error: "Neplatný požadavek." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_offer", { p_token: token, p_offer: offerId, p_decision: decision });
  if (error) {
    if (error.message.includes("rozhodnuto")) return { ok: false, error: "O této nabídce už je rozhodnuto." };
    if (error.message.includes("uzavřená")) return { ok: false, error: "Poptávka je už uzavřená." };
    return { ok: false, error: "Nepodařilo se uložit. Zkuste to prosím znovu." };
  }
  return { ok: true };
}
