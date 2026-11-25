"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { CreateResult } from "@/lib/documents/issue";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PNG_PREFIX = "data:image/png;base64,";
const MAX_BYTES = 280_000;

/**
 * Uloží podpis prstem. Obrázek přijde z plátna v prohlížeči jako PNG; ověříme, že to opravdu je PNG
 * rozumné velikosti. Otisk dokladu a čas podpisu doplní databáze (sign_document).
 */
export async function signDocument(documentId: string, side: string, name: string, place: string, image: string): Promise<CreateResult> {
  await requireStaff();
  if (!UUID.test(documentId)) return { ok: false, error: "Neplatný doklad." };
  if (side !== "supplier" && side !== "customer") return { ok: false, error: "Neznámá strana podpisu." };
  const signer = name.replace(/\s+/g, " ").trim();
  if (signer.length < 2 || signer.length > 120) return { ok: false, error: "Vyplňte jméno a příjmení podepisujícího." };
  const where = place.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!image.startsWith(PNG_PREFIX)) return { ok: false, error: "Podpis se nepodařilo načíst. Zkuste to znovu." };
  const bytes = Buffer.from(image.slice(PNG_PREFIX.length), "base64");
  if (bytes.length < 100 || bytes.length > MAX_BYTES || bytes.readUInt32BE(0) !== 0x89504e47) {
    return { ok: false, error: "Podpis se nepodařilo načíst. Zkuste to znovu." };
  }

  const supabase = await createClient();
  const ua = (await headers()).get("user-agent") ?? null;
  const { error } = await supabase.rpc("sign_document", {
    p_document: documentId, p_side: side, p_name: signer, p_image: PNG_PREFIX + bytes.toString("base64"), p_place: where || null, p_user_agent: ua,
  });
  if (error) {
    const m = error.message;
    if (m.includes("už je")) return { ok: false, error: "Za tuto stranu už je doklad podepsaný." };
    if (m.includes("oprávnění")) return { ok: false, error: "Nemáte oprávnění podepisovat doklady." };
    if (m.includes("jen pro čtení")) return { ok: false, error: "Účet je v režimu jen pro čtení." };
    if (m.includes("vystavený")) return { ok: false, error: "Podepsat jde jen vystavený doklad." };
    return { ok: false, error: "Podpis se nepodařilo uložit." };
  }
  revalidatePath(`/app/doklady/${documentId}`);
  return { ok: true, id: documentId };
}
