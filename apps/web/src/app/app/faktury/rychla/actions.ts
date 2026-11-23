"use server";

import { z } from "zod";
import { isValidCzDic, isValidIco } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fromHundredths, parseInput } from "@/lib/money";
import { createInvoice, type CreateResult } from "@/app/app/doklady/actions";

const text = (max: number) => z.string().trim().max(max);

const schema = z.object({
  clientId: z.string(),
  client: z.object({
    kind: z.enum(["company", "person"]),
    name: text(200),
    ico: text(8),
    dic: text(14).toUpperCase(),
    street: text(200),
    city: text(100),
    zip: text(10),
    email: z.union([z.literal(""), z.string().trim().email("E-mail odběratele není platný")]),
  }),
  subject: text(200),
  items: z
    .array(z.object({ description: text(300), qty: z.string().max(20), unit: text(12), unitPrice: z.string().max(20) }))
    .max(100),
  vatMode: z.enum(["standard", "reverse_charge", "non_payer"]),
  vatRate: z.union([z.literal(0), z.literal(12), z.literal(21)]),
  taxableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vyplňte datum zdanitelného plnění."),
});

export type QuickInvoiceInput = z.infer<typeof schema>;

/**
 * Rychlá faktura: odběratel + položky → vystavená faktura.
 * Na pozadí se uloží zákazník i zakázka (stav Dokončeno), takže faktura má stejná pravidla jako ze zakázky
 * a uživatel může později doplnit náklady a sledovat zisk.
 */
export async function quickInvoice(input: QuickInvoiceInput): Promise<CreateResult & { jobId?: string }> {
  const company = await requireStaff();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Zkontrolujte údaje." };
  const v = parsed.data;

  // Bez potvrzeného e-mailu databáze fakturu nevystaví – řekneme to dřív, než se uloží klient a zakázka.
  const { data: emailStatus } = await (await createClient()).rpc("my_email_status");
  if (emailStatus && (emailStatus as { verified?: boolean }).verified === false) {
    return { ok: false, error: "Fakturu vystavíte po potvrzení e-mailu. Klikněte na odkaz, který jsme vám poslali (nahoře můžete poslat nový)." };
  }

  const items = v.items.filter((i) => i.description || parseInput(i.qty) || parseInput(i.unitPrice));
  if (items.length === 0) return { ok: false, error: "Přidejte aspoň jednu položku." };
  if (items.some((i) => !i.description)) return { ok: false, error: "Každá položka musí mít popis." };
  if (items.some((i) => parseInput(i.qty) <= 0)) return { ok: false, error: "Množství musí být větší než nula." };
  if (items.some((i) => parseInput(i.unitPrice) < 0)) return { ok: false, error: "Cena nesmí být záporná." };

  const supabase = await createClient();

  // Odběratel: vybraný klient, nebo nový (uloží se do adresáře).
  let clientId = v.clientId;
  let clientName = "";
  if (clientId) {
    if (!z.string().uuid().safeParse(clientId).success) return { ok: false, error: "Neplatný zákazník." };
    const { data } = await supabase.from("clients").select("name").eq("company_id", company.id).eq("id", clientId).single();
    if (!data) return { ok: false, error: "Zákazník nenalezen." };
    clientName = data.name;
  } else {
    const c = v.client;
    if (!c.name) return { ok: false, error: "Vyplňte jméno nebo název odběratele." };
    if (c.ico && !isValidIco(c.ico)) return { ok: false, error: "IČO odběratele není platné." };
    if (c.dic && !isValidCzDic(c.dic) && !/^[A-Z]{2}[0-9A-Z]{2,12}$/.test(c.dic)) return { ok: false, error: "DIČ odběratele není platné." };
    const { data, error } = await supabase
      .from("clients")
      .insert({
        company_id: company.id,
        kind: c.ico ? "company" : c.kind,
        name: c.name,
        ico: c.ico ? c.ico.padStart(8, "0") : null,
        dic: c.dic || null,
        street: c.street || null,
        city: c.city || null,
        zip: c.zip || null,
        email: c.email || null,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Odběratele se nepodařilo uložit." };
    clientId = data.id;
    clientName = c.name;
  }

  const num = (s: string) => fromHundredths(parseInput(s));
  const vatMode = company.vatPayer ? v.vatMode : "non_payer";
  const { data: jobId, error: jobError } = await supabase.rpc("save_job", {
    p_company: company.id,
    p_job: {
      id: "",
      title: v.subject || `Faktura – ${clientName}`,
      status: "done",
      client_id: clientId,
      new_client_name: "",
      site_address: "",
      date_from: "",
      date_to: v.taxableDate,
      vat_mode: vatMode,
      vat_rate: vatMode === "standard" ? v.vatRate : 0,
      discount_kind: "",
      discount_value: "",
      note: "Rychlá faktura",
      work: items.map((i) => ({ description: i.description, qty: num(i.qty), unit: i.unit || "ks", unit_price: num(i.unitPrice) })),
      materials: [],
      labor: [],
      expenses: [],
    },
  });
  if (jobError || !jobId) {
    return { ok: false, error: jobError?.message.includes("row-level security") ? "Zkušební období skončilo – fakturu teď vystavit nejde." : "Fakturu se nepodařilo připravit." };
  }

  const res = await createInvoice(String(jobId), v.taxableDate);
  return { ...res, jobId: String(jobId) };
}
