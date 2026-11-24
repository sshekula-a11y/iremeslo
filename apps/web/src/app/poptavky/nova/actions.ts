"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, REGION_LABEL } from "@/lib/inquiries";

export type InquiryState = { error?: string };

const schema = z.object({
  category: z.string().refine((v) => !!CATEGORY_LABEL[v], "Vyberte obor."),
  title: z.string().trim().min(5, "Napište stručně, co poptáváte (alespoň 5 znaků).").max(120, "Název může mít nejvýše 120 znaků."),
  quantity: z.string().trim().transform((v) => v.replace(/\s/g, "").replace(",", "."))
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0), "Rozsah zadejte jako číslo, např. 500."),
  unit: z.enum(["", "m2", "bm", "ks", "hod", "pausal"]),
  description: z.string().trim().min(20, "Popište práci podrobněji (alespoň 20 znaků).").max(3000, "Popis může mít nejvýše 3000 znaků."),
  city: z.string().trim().min(2, "Vyplňte obec.").max(100),
  zip: z.string().trim().refine((v) => v === "" || /^\d{3} ?\d{2}$/.test(v), "PSČ má tvar 602 00."),
  region: z.string().refine((v) => !!REGION_LABEL[v], "Vyberte kraj."),
  street: z.string().trim().max(200),
  term: z.enum(["flexible", "asap", "date"]),
  term_from: z.string().trim(),
  term_date: z.string().trim(),
  photos_folder: z.string().trim().refine((v) => v === "" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v), "Fotky se nepodařilo připojit. Zkuste je přidat znovu."),
  contact_name: z.string().trim().min(2, "Vyplňte své jméno.").max(100),
  contact_phone: z.string().trim().refine((v) => v === "" || /^\+?[0-9 ]{9,20}$/.test(v), "Telefon zadejte jako 777 123 456 nebo +420 777 123 456."),
  contact_email: z.string().trim().toLowerCase().email("Zadejte platný e-mail – pošleme na něj odkaz k potvrzení."),
});

export async function submitInquiry(_prev: InquiryState, form: FormData): Promise<InquiryState> {
  // Skryté pole pro roboty: člověk ho nevidí, robot ho vyplní.
  if (String(form.get("web") ?? "") !== "") redirect("/poptavky/odeslano");
  if (form.get("consent") !== "on") return { error: "Pro zveřejnění poptávky je potřeba souhlas s podmínkami." };

  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(form.get(k) ?? "")]));
  const p = schema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Zkontrolujte údaje." };
  const v = p.data;
  if (v.term === "date") {
    const today = new Date().toISOString().slice(0, 10);
    if (!v.term_from && !v.term_date) return { error: "Zadejte datum zahájení nebo dokončení." };
    if ((v.term_from && v.term_from < today) || (v.term_date && v.term_date < today)) return { error: "Zadejte termín v budoucnosti." };
    if (v.term_from && v.term_date && v.term_date < v.term_from) return { error: "Dokončení nesmí být před zahájením." };
  }
  if (v.unit && v.unit !== "pausal" && !v.quantity) return { error: "K jednotce doplňte rozsah, např. 500 m²." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_inquiry", {
    p: { ...v, quantity: v.unit === "pausal" ? "" : v.quantity, unit: v.quantity || v.unit === "pausal" ? v.unit : "" },
  });
  if (error) {
    if (error.message.includes("příliš mnoho")) return { error: "Poptávek je teď příliš mnoho. Zkuste to prosím za chvíli." };
    if (error.message.includes("e-mail")) return { error: "Zadejte platný e-mail." };
    if (error.message.includes("fotky")) return { error: "Fotky se nepodařilo připojit. Odeberte je a přidejte znovu." };
    return { error: "Poptávku se nepodařilo odeslat. Zkontrolujte údaje a zkuste to znovu." };
  }
  // Bez e-mailu v adrese – adresy stránek zaznamenává Google Analytics.
  redirect("/poptavky/odeslano");
}
