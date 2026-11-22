"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { isValidIco, isValidCzDic } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Vyplňte název firmy").max(200),
  ico: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidIco(v), "IČO není platné"),
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
  if (v.vatPayer && !v.dic) return { error: "Plátce DPH musí mít vyplněné DIČ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_company", {
    p_name: v.name,
    p_ico: v.ico ? v.ico.padStart(8, "0") : "",
    p_dic: v.dic,
    p_street: v.street,
    p_city: v.city,
    p_zip: v.zip,
    p_vat_payer: v.vatPayer,
  });
  if (error) return { error: error.message.includes("5 firem") ? "Můžete mít nejvýš 5 firem." : "Firmu se nepodařilo založit." };

  (await cookies()).set("firma", String(data), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}
