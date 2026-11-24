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
