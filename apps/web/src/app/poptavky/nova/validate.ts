/**
 * Kontrola poptávky před odesláním. Formulář volá databázi přímo z prohlížeče – limit poptávek se tak počítá
 * podle skutečné adresy návštěvníka (u volání přes server webu by všichni sdíleli adresu serveru).
 * Databáze stejná pravidla hlídá znovu (omezení tabulky a funkce submit_inquiry).
 */
import { z } from "zod";
import { CATEGORY_LABEL, REGION_LABEL } from "@/lib/inquiries";

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

export type InquiryCheck = { error: string } | { payload: Record<string, string> };

export function validateInquiry(form: FormData, today: string): InquiryCheck {
  if (form.get("consent") !== "on") return { error: "Pro zveřejnění poptávky je potřeba souhlas s podmínkami." };
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(form.get(k) ?? "")]));
  const p = schema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Zkontrolujte údaje." };
  const v = p.data;
  if (v.term === "date") {
    if (!v.term_from && !v.term_date) return { error: "Zadejte datum zahájení nebo dokončení." };
    if ((v.term_from && v.term_from < today) || (v.term_date && v.term_date < today)) return { error: "Zadejte termín v budoucnosti." };
    if (v.term_from && v.term_date && v.term_date < v.term_from) return { error: "Dokončení nesmí být před zahájením." };
  }
  if (v.unit && v.unit !== "pausal" && !v.quantity) return { error: "K jednotce doplňte rozsah, např. 500 m²." };
  return { payload: { ...v, quantity: v.unit === "pausal" ? "" : v.quantity, unit: v.quantity || v.unit === "pausal" ? v.unit : "" } };
}

/** Chyba z databáze → česká hláška pro zadavatele. */
export function inquiryError(message: string): string {
  if (message.includes("jednoho místa")) return "Z vašeho připojení už přišlo několik poptávek. Další zkuste prosím za hodinu.";
  if (message.includes("příliš mnoho")) return "Poptávek je teď příliš mnoho. Zkuste to prosím za chvíli.";
  if (message.includes("e-mail")) return "Zadejte platný e-mail.";
  if (message.includes("fotky")) return "Fotky se nepodařilo připojit. Odeberte je a přidejte znovu.";
  if (message.includes("termín") || message.includes("datum") || message.includes("dokončení")) return message.charAt(0).toUpperCase() + message.slice(1) + ".";
  return "Poptávku se nepodařilo odeslat. Zkontrolujte údaje a zkuste to znovu.";
}
