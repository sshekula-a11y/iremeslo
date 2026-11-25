"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { CreateResult } from "@/lib/documents/issue";
import { cleanPlace, cleanSignatureImage, cleanSignerName } from "@/lib/documents/signature-image";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Uloží podpis prstem. Obrázek přijde z plátna v prohlížeči jako PNG; ověříme, že to opravdu je PNG
 * rozumné velikosti. Otisk dokladu a čas podpisu doplní databáze (sign_document).
 */
export async function signDocument(documentId: string, side: string, name: string, place: string, image: string): Promise<CreateResult> {
  await requireStaff();
  if (!UUID.test(documentId)) return { ok: false, error: "Neplatný doklad." };
  if (side !== "supplier" && side !== "customer") return { ok: false, error: "Neznámá strana podpisu." };
  const signer = cleanSignerName(name);
  if (!signer) return { ok: false, error: "Vyplňte jméno a příjmení podepisujícího." };
  const where = cleanPlace(place);
  const png = cleanSignatureImage(image);
  if (!png) return { ok: false, error: "Podpis se nepodařilo načíst. Zkuste to znovu." };

  const supabase = await createClient();
  const ua = (await headers()).get("user-agent") ?? null;
  const { error } = await supabase.rpc("sign_document", {
    p_document: documentId, p_side: side, p_name: signer, p_image: png, p_place: where || null, p_user_agent: ua,
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

/** Odkaz k podpisu na dálku; s e-mailem ho databáze rovnou pošle zákazníkovi. */
export async function createSignLink(documentId: string, email: string): Promise<{ ok: true; link: string; emailed: boolean } | { ok: false; error: string }> {
  await requireStaff();
  if (!UUID.test(documentId)) return { ok: false, error: "Neplatný doklad." };
  const mail = email.trim();
  if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { ok: false, error: "Zkontrolujte e-mail zákazníka." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sign_request", { p_document: documentId, p_email: mail || null });
  if (error || !data) {
    const m = error?.message ?? "";
    if (m.includes("už je")) return { ok: false, error: "Zákazník už doklad podepsal." };
    if (m.includes("e-mail")) return { ok: false, error: "Zkontrolujte e-mail zákazníka." };
    if (m.includes("jen pro čtení")) return { ok: false, error: "Účet je v režimu jen pro čtení." };
    return { ok: false, error: "Odkaz se nepodařilo vytvořit." };
  }
  const r = data as { link: string; emailed: boolean };
  revalidatePath(`/app/doklady/${documentId}`);
  return { ok: true, link: r.link, emailed: r.emailed };
}

export async function cancelSignLink(documentId: string): Promise<void> {
  await requireStaff();
  if (!UUID.test(documentId)) return;
  const supabase = await createClient();
  await supabase.rpc("cancel_sign_request", { p_document: documentId });
  revalidatePath(`/app/doklady/${documentId}`);
}
