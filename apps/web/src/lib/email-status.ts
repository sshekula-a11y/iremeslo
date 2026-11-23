"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResendState = { ok?: boolean; error?: string; email?: string };

/** Znovu pošle odkaz pro potvrzení e-mailu (databáze hlídá 2 minuty mezi pokusy a 5 denně). */
export async function resendVerification(_prev: ResendState): Promise<ResendState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resend_verification");
  if (error) {
    const m = error.message;
    if (m.includes("2 minuty")) return { error: "E-mail jsme poslali před chvílí. Zkuste to znovu za 2 minuty." };
    if (m.includes("5 e-mailů")) return { error: "Dnes jsme už poslali 5 e-mailů. Zkuste to zítra, nebo napište na info@iremeslo.cz." };
    return { error: "E-mail se nepodařilo poslat. Zkuste to prosím znovu." };
  }
  const r = (data ?? {}) as { already?: boolean; sent?: boolean; email?: string };
  if (r.already) {
    revalidatePath("/app", "layout");
    return { ok: true };
  }
  if (!r.sent) return { error: "Odesílání e-mailů se teprve nastavuje. Zkuste to prosím později, nebo napište na info@iremeslo.cz." };
  return { ok: true, email: r.email };
}
