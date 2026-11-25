"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { cleanPlace, cleanSignatureImage, cleanSignerName } from "@/lib/documents/signature-image";

/** Zákazník podepisuje přes odkaz – bez přihlášení; oprávnění je samotný odkaz (ověří databáze). */
export async function signByToken(token: string, name: string, place: string, image: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f]{48}$/.test(token)) return { ok: false, error: "Odkaz neplatí." };
  const signer = cleanSignerName(name);
  if (!signer) return { ok: false, error: "Vyplňte své jméno a příjmení." };
  const png = cleanSignatureImage(image);
  if (!png) return { ok: false, error: "Podpis se nepodařilo načíst. Zkuste to znovu." };
  const supabase = await createClient();
  const ua = (await headers()).get("user-agent") ?? null;
  const { error } = await supabase.rpc("sign_by_token", { p_token: token, p_name: signer, p_image: png, p_place: cleanPlace(place) || null, p_user_agent: ua });
  if (error) {
    if (error.message.includes("už je")) return { ok: false, error: "Dokument už je podepsaný." };
    if (error.message.includes("vypršela")) return { ok: false, error: "Platnost odkazu vypršela. Požádejte o nový." };
    if (error.message.includes("neplatí")) return { ok: false, error: "Odkaz neplatí. Požádejte o nový." };
    return { ok: false, error: "Podpis se nepodařilo uložit. Zkuste to znovu." };
  }
  return { ok: true };
}
