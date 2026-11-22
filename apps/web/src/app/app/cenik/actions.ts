"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEFAULT_UNITS } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fromHundredths, parseInput } from "@/lib/money";

const schema = z.object({
  kind: z.enum(["work", "material"]),
  name: z.string().trim().min(1).max(300),
  unit: z.enum(DEFAULT_UNITS),
  purchase_price: z.string(),
  sale_price: z.string(),
});

const price = (s: string) => fromHundredths(Math.max(0, parseInput(s)));

function read(form: FormData) {
  const v = schema.parse({
    kind: form.get("kind"),
    name: form.get("name"),
    unit: form.get("unit"),
    purchase_price: String(form.get("purchase_price") ?? ""),
    sale_price: String(form.get("sale_price") ?? ""),
  });
  return {
    kind: v.kind,
    name: v.name,
    unit: v.unit,
    // U práce se nákupní cena nevede.
    purchase_price: v.kind === "work" ? "0.00" : price(v.purchase_price),
    sale_price: price(v.sale_price),
  };
}

export async function addCatalogItem(form: FormData) {
  const company = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").insert({ company_id: company.id, ...read(form) });
  if (error) throw new Error("Položku se nepodařilo uložit.");
  revalidatePath("/app/cenik");
}

export async function updateCatalogItem(form: FormData) {
  const company = await requireStaff();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update(read(form)).eq("company_id", company.id).eq("id", id);
  if (error) throw new Error("Položku se nepodařilo uložit.");
  revalidatePath("/app/cenik");
}

/** Položky se nemažou (mohou být použité v zakázkách), jen se skryjí z nabídky. */
export async function setCatalogItemActive(form: FormData) {
  const company = await requireStaff();
  const id = z.string().uuid().parse(form.get("id"));
  const active = form.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update({ active }).eq("company_id", company.id).eq("id", id);
  if (error) throw new Error("Nepodařilo se uložit.");
  revalidatePath("/app/cenik");
}
