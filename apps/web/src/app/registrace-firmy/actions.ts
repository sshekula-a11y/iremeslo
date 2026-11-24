"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { isValidIco, isValidCzDic } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";
import { lookupAres } from "@/lib/ares";
import { inquiryReturn } from "@/lib/safe-next";

export type RegisterState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Vyplňte název firmy").max(200),
  ico: z
    .string()
    .trim()
    .min(1, "Vyplňte IČO – zkušební období se váže na IČO firmy.")
    .refine((v) => isValidIco(v), "IČO není platné. Zkontrolujte číslice."),
  dic: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || isValidCzDic(v), "DIČ má tvar CZ a 8–10 číslic"),
  street: z.string().trim().max(200),
  city: z.string().trim().max(100),
  zip: z.string().trim().max(10),
  vatPayer: z.boolean(),
});

export async function registerCompany(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  const parsed = schema.safeParse({
    name: form.get("name"),
    ico: form.get("ico") ?? "",
    dic: form.get("dic") ?? "",
    street: form.get("street") ?? "",
    city: form.get("city") ?? "",
    zip: form.get("zip") ?? "",
    vatPayer: form.get("vatPayer") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const v = parsed.data;

  const ico = v.ico.padStart(8, "0");
  // Vymyšlené IČO neprojde. Když ARES zrovna neodpovídá, registraci kvůli tomu neblokujeme.
  const ares = await lookupAres(ico);
  if (!ares.ok && ares.reason === "not_found") return { error: "Firmu s tímto IČO jsme v ARES nenašli. Zkontrolujte číslo." };
  // Co člověk nevyplnil, doplníme z ARES (hlavně DIČ, když údaje nenačetl tlačítkem).
  if (ares.ok) {
    const a = ares.company;
    if (!v.dic && a.dic) v.dic = a.dic.toUpperCase();
    if (!v.street) v.street = a.street;
    if (!v.city) v.city = a.city;
    if (!v.zip) v.zip = a.zip;
  }
  if (v.vatPayer && !v.dic) return { error: "Plátce DPH musí mít vyplněné DIČ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_company", {
    p_name: v.name,
    p_ico: ico,
    p_dic: v.dic,
    p_street: v.street,
    p_city: v.city,
    p_zip: v.zip,
    p_vat_payer: v.vatPayer,
  });
  if (error) {
    if (error.message.includes("5 firem")) return { error: "Můžete mít nejvýše 5 firem." };
    if (error.message.includes("IČO")) return { error: "Vyplňte platné IČO (8 číslic)." };
    return { error: "Firmu se nepodařilo založit." };
  }

  (await cookies()).set("firma", String(data), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(inquiryReturn(form.get("next")) ?? "/app");
}

export type TrialInfo = { used: false; days: number } | { used: true; trialEnd: string; active: boolean };

/** Zkušební období pro IČO – formulář ho ukáže hned po zadání IČO, ještě před založením firmy. */
export async function checkTrial(rawIco: string): Promise<TrialInfo | null> {
  if (!isValidIco(rawIco)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trial_for_ico", { p_ico: rawIco.trim().padStart(8, "0") });
  if (error || !data) return null;
  const d = data as { used: boolean; days?: number; trial_end?: string; active?: boolean };
  return d.used ? { used: true, trialEnd: d.trial_end ?? "", active: Boolean(d.active) } : { used: false, days: d.days ?? 30 };
}
