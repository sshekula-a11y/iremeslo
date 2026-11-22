"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { czAccountToIban, isValidCzDic, isValidIban, isValidIco, normalizeIban } from "@iremeslo/core";
import { requireCompany } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fromHundredths, parseInput } from "@/lib/money";
import { THEMES } from "@/lib/documents/themes";

export type SettingsState = { ok?: boolean; error?: string };

const text = (max: number) => z.string().trim().max(max);

const schema = z.object({
  name: z.string().trim().min(2, "Vyplňte název firmy").max(200),
  ico: text(8).refine((v) => v === "" || isValidIco(v), "IČO není platné"),
  dic: text(14).toUpperCase().refine((v) => v === "" || isValidCzDic(v), "DIČ má tvar CZ a 8–10 číslic"),
  street: text(200),
  city: text(100),
  zip: text(10),
  email: z.union([z.literal(""), z.string().trim().email("E-mail není platný")]),
  phone: text(40),
  web: text(200),
  register_entry: text(300),
  bank_account: text(30),
  iban: text(42),
  bic: text(11).toUpperCase().refine((v) => v === "" || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v), "BIC/SWIFT má 8 nebo 11 znaků"),
  vat_payer: z.boolean(),
  default_vat_rate: z.enum(["21", "12"]),
  payment_terms_days: z.coerce.number().int("Splatnost je celý počet dní").min(0).max(365, "Splatnost nejvýš 365 dní"),
  material_markup_pct: z.string(),
  min_margin_pct: z.string(),
  invoice_theme: z.enum(Object.keys(THEMES) as [keyof typeof THEMES, ...(keyof typeof THEMES)[]]),
});

/** Údaje firmy smí měnit jen majitel (hlídá i databáze). */
export async function saveCompany(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const company = await requireCompany();
  if (company.role !== "owner") return { error: "Údaje firmy může měnit jen majitel." };

  const parsed = schema.safeParse({
    ...Object.fromEntries(
      ["name", "ico", "dic", "street", "city", "zip", "email", "phone", "web", "register_entry", "bank_account", "iban", "bic",
        "default_vat_rate", "payment_terms_days", "material_markup_pct", "min_margin_pct", "invoice_theme"].map((k) => [k, String(form.get(k) ?? "")]),
    ),
    vat_payer: form.get("vat_payer") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Zkontrolujte údaje." };
  const v = parsed.data;
  if (v.vat_payer && !v.dic) return { error: "Plátce DPH musí mít vyplněné DIČ." };

  // Český účet → IBAN se dopočítá; zahraniční účet jde zadat rovnou jako IBAN.
  let iban = v.iban ? normalizeIban(v.iban) : "";
  if (v.bank_account) {
    try {
      iban = czAccountToIban(v.bank_account);
    } catch (e) {
      return { error: `Číslo účtu: ${e instanceof Error ? e.message : "neplatné"}.` };
    }
  }
  if (iban && !isValidIban(iban)) return { error: "IBAN není platný." };

  const markup = parseInput(v.material_markup_pct);
  const margin = parseInput(v.min_margin_pct);
  if (markup < 0 || markup > 100_000) return { error: "Přirážka na materiál musí být 0–1000 %." };
  if (margin < 0 || margin > 10_000) return { error: "Hranice marže musí být 0–100 %." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name: v.name,
      ico: v.ico ? v.ico.padStart(8, "0") : null,
      dic: v.dic || null,
      street: v.street || null,
      city: v.city || null,
      zip: v.zip || null,
      email: v.email || null,
      phone: v.phone || null,
      web: v.web || null,
      register_entry: v.register_entry || null,
      bank_account: v.bank_account.replace(/\s/g, "") || null,
      iban: iban || null,
      bic: v.bic || null,
      vat_payer: v.vat_payer,
      default_vat_rate: v.vat_payer ? Number(v.default_vat_rate) : 21,
      payment_terms_days: v.payment_terms_days,
      material_markup_pct: fromHundredths(markup),
      min_margin_pct: fromHundredths(margin),
      invoice_theme: v.invoice_theme,
    })
    .eq("id", company.id);
  if (error) return { error: error.message.includes("jen pro čtení") ? "Účet je v režimu jen pro čtení." : "Uložení se nepovedlo." };

  revalidatePath("/app", "layout");
  return { ok: true };
}

const IMAGE_COLUMNS = { logo: "logo_path", stamp: "stamp_path", signature: "signature_path" } as const;
export type BrandImage = keyof typeof IMAGE_COLUMNS;

/**
 * Zapíše (nebo odebere) obrázek, který prohlížeč nahrál do úložiště firmy.
 * Cesta musí ležet ve složce firmy, jinak by šlo podstrčit cizí soubor.
 */
export async function setBrandImage(kind: BrandImage, path: string | null): Promise<SettingsState> {
  const company = await requireCompany();
  if (company.role !== "owner") return { error: "Obrázky firmy může měnit jen majitel." };
  if (!(kind in IMAGE_COLUMNS)) return { error: "Neznámý obrázek." };
  if (path !== null && !new RegExp(`^${company.id}/brand/${kind}-[a-z0-9]+\\.(png|jpg)$`).test(path)) return { error: "Neplatná cesta souboru." };

  const supabase = await createClient();
  const column = IMAGE_COLUMNS[kind];
  const { data: before } = await supabase.from("companies").select(column).eq("id", company.id).single();
  const { error } = await supabase.from("companies").update({ [column]: path }).eq("id", company.id);
  if (error) return { error: "Uložení se nepovedlo." };

  // Starý soubor smažeme, ať v úložišti nezůstávají nepoužité obrázky.
  const old = (before as Record<string, string | null> | null)?.[column];
  if (old && old !== path) await supabase.storage.from("files").remove([old]);

  revalidatePath("/app/nastaveni");
  return { ok: true };
}
