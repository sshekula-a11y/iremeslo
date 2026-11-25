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

// ---------------------------------------------------------------------------
// Import a export zákazníků (soubory čte a skládá prohlížeč – lib/contacts-io.ts)
// ---------------------------------------------------------------------------

export interface ImportRow {
  kind: "person" | "company"; name: string; ico: string; dic: string; phone: string; email: string;
  street: string; city: string; zip: string; contact_person: string; note: string;
}
export type ImportResult = { ok: true; inserted: number; duplicates: number; fixed: number } | { ok: false; error: string };

const MAX_IMPORT = 2000;
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-9);
const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Uloží zákazníky ze souboru. Duplicity (stejné IČO, e-mail, telefon, nebo jméno + obec) přeskočí. */
export async function importClients(rows: ImportRow[]): Promise<ImportResult> {
  const company = await requireStaff();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Soubor neobsahuje žádné kontakty." };
  if (rows.length > MAX_IMPORT) return { ok: false, error: `Najednou jde nahrát nejvýš ${MAX_IMPORT} kontaktů.` };
  const supabase = await createClient();
  const { data: existing, error: e1 } = await supabase.from("clients").select("name, ico, email, phone, city").eq("company_id", company.id);
  if (e1) return { ok: false, error: "Zákazníky se nepodařilo načíst." };

  const seen = new Set<string>();
  const keys = (r: { name: string; ico: string | null; email: string | null; phone: string | null; city: string | null }) => [
    r.ico ? `i:${r.ico}` : "", r.email ? `e:${lower(r.email)}` : "", digits(r.phone).length >= 9 ? `p:${digits(r.phone)}` : "",
    `n:${lower(r.name)}|${lower(r.city)}`,
  ].filter(Boolean);
  for (const c of existing ?? []) for (const k of keys(c)) seen.add(k);

  const email = z.string().email();
  let duplicates = 0, fixed = 0;
  const insert: Record<string, unknown>[] = [];
  for (const raw of rows) {
    const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const name = s(raw.name, 200);
    if (!name) continue;
    let ico = s(raw.ico, 12).replace(/\D/g, "");
    if (ico && !isValidIco(ico)) { ico = ""; fixed++; }
    if (ico) ico = ico.padStart(8, "0");
    let mail = s(raw.email, 254).toLowerCase();
    if (mail && !email.safeParse(mail).success) { mail = ""; fixed++; }
    const row = {
      kind: raw.kind === "company" ? "company" : "person",
      name, ico: ico || null, dic: s(raw.dic, 14).toUpperCase() || null, phone: s(raw.phone, 40) || null, email: mail || null,
      street: s(raw.street, 200) || null, city: s(raw.city, 100) || null, zip: s(raw.zip, 10) || null,
      contact_person: s(raw.contact_person, 200) || null, note: s(raw.note, 1000) || null,
    };
    const k = keys(row);
    if (k.some((x) => seen.has(x))) { duplicates++; continue; }
    for (const x of k) seen.add(x);
    insert.push({ ...row, company_id: company.id, marketing_consent: false });
  }
  for (let i = 0; i < insert.length; i += 500) {
    const { error } = await supabase.from("clients").insert(insert.slice(i, i + 500));
    if (error) return { ok: false, error: i ? `Uloženo ${i} kontaktů, zbytek se nepodařilo uložit.` : "Kontakty se nepodařilo uložit." };
  }
  revalidatePath("/app/zakaznici");
  return { ok: true, inserted: insert.length, duplicates, fixed };
}

/** Všichni zákazníci firmy pro export do vCard / Excelu. */
export async function exportClients(): Promise<ImportRow[]> {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("clients")
    .select("kind, name, ico, dic, phone, email, street, city, zip, contact_person, note")
    .eq("company_id", company.id).order("name");
  return (data ?? []).map((c) => ({
    kind: c.kind as ImportRow["kind"], name: c.name, ico: c.ico ?? "", dic: c.dic ?? "", phone: c.phone ?? "", email: c.email ?? "",
    street: c.street ?? "", city: c.city ?? "", zip: c.zip ?? "", contact_person: c.contact_person ?? "", note: c.note ?? "",
  }));
}
