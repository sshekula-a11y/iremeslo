"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fromHundredths, parseInput } from "@/lib/money";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40),
  rate_hour: z.string(),
  rate_day: z.string(),
});

export async function addEmployee(form: FormData) {
  const company = await requireStaff();
  const v = schema.parse({
    name: form.get("name"),
    phone: form.get("phone") ?? "",
    rate_hour: String(form.get("rate_hour") ?? ""),
    rate_day: String(form.get("rate_day") ?? ""),
  });
  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    company_id: company.id,
    name: v.name,
    phone: v.phone || null,
    rate_hour: fromHundredths(Math.max(0, parseInput(v.rate_hour))),
    rate_day: fromHundredths(Math.max(0, parseInput(v.rate_day))),
  });
  if (error) throw new Error("Nepodařilo se uložit.");
  revalidatePath("/app/zamestnanci");
}
