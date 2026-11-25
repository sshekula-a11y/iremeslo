"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidIco } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  kind: z.enum(["person", "company"]),
  name: z.string().trim().min(1).max(200),
  ico: z.string().trim().refine((v) => v === "" || isValidIco(v)),
  dic: z.string().trim().toUpperCase().max(14),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.string().trim().email()]),
  street: z.string().trim().max(200),
  city: z.string().trim().max(100),
  zip: z.string().trim().max(10),
  consent: z.boolean(),
});

export async function addClient(form: FormData) {
  const company = await requireStaff();
  const v = schema.parse({
    kind: form.get("kind") ?? "person",
    name: form.get("name"),
    ico: form.get("ico") ?? "",
    dic: form.get("dic") ?? "",
    phone: form.get("phone") ?? "",
    email: form.get("email") ?? "",
    street: form.get("street") ?? "",
    city: form.get("city") ?? "",
    zip: form.get("zip") ?? "",
    consent: form.get("consent") === "on",
  });
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({
    company_id: company.id,
    kind: v.kind,
    name: v.name,
    ico: v.ico ? v.ico.padStart(8, "0") : null,
    dic: v.kind === "company" && v.dic ? v.dic : null,
    phone: v.phone || null,
    email: v.email || null,
    street: v.street || null,
    city: v.city || null,
    zip: v.zip || null,
    marketing_consent: v.consent,
    marketing_consent_at: v.consent ? new Date().toISOString() : null,
  });
  if (error) throw new Error("Zákazníka se nepodařilo uložit.");
  revalidatePath("/app/zakaznici");
}
