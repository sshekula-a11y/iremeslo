"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type OfferResult = { ok: true; isNew: boolean } | { ok: false; error: string };

const MESSAGES: [string, string][] = [
  ["ověřeným v ARES", "Nabídku pošle jen firma s IČO ověřeným v ARES."],
  ["potvrďte svůj e-mail", "Nejdřív potvrďte svůj e-mail – odkaz najdete v aplikaci."],
  ["nepřijímá", "Poptávka už nepřijímá nabídky."],
  ["ukázkové", "U ukázkové poptávky nabídku poslat nejde."],
  ["v minulosti", "Termín zahájení nemůže být v minulosti."],
  ["30 nabídek", "Dnes jste poslali už 30 nabídek. Další pošlete zítra."],
  ["rozhodl", "Zákazník už o nabídce rozhodl."],
  ["jen pro čtení", "Účet je v režimu jen pro čtení."],
];

export async function sendOffer(inquiryId: string, f: { price: string; start: string; duration: string; message: string; validDays: string }): Promise<OfferResult> {
  const company = await requireCompany();
  if (company.role === "worker") return { ok: false, error: "Nabídku posílá majitel nebo kancelář." };
  if (!UUID.test(inquiryId)) return { ok: false, error: "Neplatná poptávka." };
  const price = Number(f.price.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0 || price >= 100_000_000) return { ok: false, error: "Zadejte cenu v korunách." };
  const message = f.message.trim();
  if (message.length < 10) return { ok: false, error: "Napište zákazníkovi pár slov k nabídce (aspoň 10 znaků)." };
  if (message.length > 2000) return { ok: false, error: "Zpráva je příliš dlouhá (nejvýš 2 000 znaků)." };
  const start = /^\d{4}-\d{2}-\d{2}$/.test(f.start) ? f.start : null;
  const validDays = [7, 14, 30].includes(Number(f.validDays)) ? Number(f.validDays) : 14;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_offer", {
    p_company: company.id, p_inquiry: inquiryId, p_price: price, p_start: start,
    p_duration: f.duration.trim().slice(0, 80) || null, p_message: message, p_valid_days: validDays,
  });
  if (error) return { ok: false, error: MESSAGES.find(([k]) => error.message.includes(k))?.[1] ?? "Nabídku se nepodařilo odeslat." };
  revalidatePath(`/poptavky/${inquiryId}`);
  revalidatePath("/app/nabidky");
  return { ok: true, isNew: !!(data as { new?: boolean } | null)?.new };
}

export async function withdrawOffer(inquiryId: string, offerId: string): Promise<{ ok: boolean }> {
  const company = await requireCompany();
  if (!UUID.test(offerId)) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.rpc("withdraw_offer", { p_company: company.id, p_offer: offerId });
  revalidatePath(`/poptavky/${inquiryId}`);
  revalidatePath("/app/nabidky");
  return { ok: !!data };
}
