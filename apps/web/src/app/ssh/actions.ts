"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";

export type AdminState = { ok?: boolean; error?: string; message?: string };

const uuid = z.string().uuid();
const reason = z.string().trim().min(3, "Uveďte důvod (alespoň 3 znaky).").max(300);

function fail(e: { message?: string } | null, fallback: string): AdminState {
  const m = e?.message ?? "";
  // Hlášky z databázových funkcí jsou česky a srozumitelné, ostatní nahradíme obecnou.
  return { error: /^[a-zěščřžýáíéůúťďň ]/i.test(m) && m.length < 120 ? m.charAt(0).toUpperCase() + m.slice(1) + "." : fallback };
}

function refresh(companyId?: string) {
  revalidatePath("/ssh", "layout");
  if (companyId) revalidatePath(`/ssh/firmy/${companyId}`);
}

export async function setUserBanned(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const p = z.object({ user: uuid, banned: z.enum(["true", "false"]), reason, company: z.string().optional() }).safeParse({
    user: form.get("user"), banned: form.get("banned"), reason: form.get("reason"), company: form.get("company") ?? undefined,
  });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const { error } = await supabase.rpc("admin_set_user_banned", { p_user: p.data.user, p_banned: p.data.banned === "true", p_reason: p.data.reason });
  if (error) return fail(error, "Nepodařilo se uložit.");
  refresh(p.data.company);
  return { ok: true, message: p.data.banned === "true" ? "Uživatel je zablokovaný." : "Uživatel je odblokovaný." };
}

export async function setReadOnly(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const p = z.object({ company: uuid, value: z.enum(["true", "false"]), reason }).safeParse({
    company: form.get("company"), value: form.get("value"), reason: form.get("reason"),
  });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const { error } = await supabase.rpc("admin_set_read_only", { p_company: p.data.company, p_value: p.data.value === "true", p_reason: p.data.reason });
  if (error) return fail(error, "Nepodařilo se uložit.");
  refresh(p.data.company);
  return { ok: true, message: p.data.value === "true" ? "Firma je jen pro čtení." : "Firma může znovu zapisovat." };
}

export async function setSubscription(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const p = z.object({
    company: uuid,
    plan: z.string().min(1),
    status: z.enum(["trialing", "active", "past_due", "canceled"]),
    period_end: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    interval: z.enum(["", "month", "year"]),
    note: z.string().trim().max(300),
  }).safeParse(Object.fromEntries(["company", "plan", "status", "period_end", "interval", "note"].map((k) => [k, String(form.get(k) ?? "")])));
  if (!p.success) return { error: "Zkontrolujte údaje." };
  const v = p.data;
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_company: v.company, p_plan: v.plan, p_status: v.status, p_period_end: v.period_end || null, p_interval: v.interval || null, p_note: v.note,
  });
  if (error) return fail(error, "Nepodařilo se uložit.");
  refresh(v.company);
  return { ok: true, message: "Tarif uložen." };
}

export async function recordPayment(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const p = z.object({
    company: uuid,
    amount: z.string().trim().regex(/^\d+([.,]\d{1,2})?$/, "Zadejte částku, např. 199 nebo 1999,00."),
    paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vyplňte datum platby."),
    plan: z.string().min(1),
    interval: z.enum(["month", "year"]),
    note: z.string().trim().max(300),
  }).safeParse(Object.fromEntries(["company", "amount", "paid_on", "plan", "interval", "note"].map((k) => [k, String(form.get(k) ?? "")])));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const v = p.data;
  const { data, error } = await supabase.rpc("admin_record_payment", {
    p_company: v.company, p_amount: v.amount.replace(",", "."), p_paid_on: v.paid_on, p_plan: v.plan, p_interval: v.interval, p_note: v.note,
  });
  if (error) return fail(error, "Platbu se nepodařilo zapsat.");
  refresh(v.company);
  const [y, m, d] = String(data).split("-");
  return { ok: true, message: `Platba zapsána, předplatné do ${Number(d)}. ${Number(m)}. ${y}.` };
}

// ---------------------------------------------------------------------------
// E-maily (Resend). Klíč jde rovnou do trezoru Supabase Vault, zpátky se nikdy nezobrazí.
// ---------------------------------------------------------------------------

export async function saveEmailSettings(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const key = String(form.get("api_key") ?? "").trim();
  const siteUrl = String(form.get("site_url") ?? "").trim();
  const mailFrom = String(form.get("mail_from") ?? "").trim();
  const { error } = await supabase.rpc("admin_set_email_settings", {
    p_api_key: key || null,
    p_site_url: siteUrl || null,
    p_mail_from: mailFrom || null,
  });
  if (error) return fail(error, "Nastavení se nepodařilo uložit.");
  revalidatePath("/ssh/emaily");
  return { ok: true, message: key ? "Uloženo, klíč je v trezoru." : "Uloženo." };
}

export async function sendTestEmail(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const to = z.string().trim().email("Zadejte platný e-mail.").safeParse(form.get("to"));
  if (!to.success) return { error: to.error.issues[0]?.message };
  const { data, error } = await supabase.rpc("admin_send_test_email", { p_to: to.data });
  if (error) return fail(error, "E-mail se nepodařilo odeslat.");
  revalidatePath("/ssh/emaily");
  if (data !== true) return { error: "Nejdřív uložte klíč Resend." };
  return { ok: true, message: "Odesláno. Za několik sekund obnovte stránku, v přehledu uvidíte odpověď Resendu." };
}

export async function verifyUserEmail(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const user = uuid.safeParse(form.get("user"));
  if (!user.success) return { error: "Neplatný uživatel." };
  const { error } = await supabase.rpc("admin_verify_user", { p_user: user.data });
  if (error) return fail(error, "Nepodařilo se uložit.");
  revalidatePath("/ssh/emaily");
  return { ok: true, message: "Potvrzeno." };
}

// ---------------------------------------------------------------------------
// Veřejné poptávky
// ---------------------------------------------------------------------------

export async function setInquiryStatus(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const p = z.object({ id: uuid, status: z.enum(["open", "closed", "hidden"]) }).safeParse({ id: form.get("id"), status: form.get("status") });
  if (!p.success) return { error: "Neplatný požadavek." };
  const { error } = await supabase.rpc("admin_set_inquiry_status", { p_id: p.data.id, p_status: p.data.status });
  if (error) return fail(error, "Nepodařilo se uložit.");
  revalidatePath("/ssh/poptavky");
  revalidatePath("/poptavky");
  return { ok: true, message: p.data.status === "open" ? "Zveřejněno." : p.data.status === "hidden" ? "Skryto." : "Uzavřeno." };
}

// ---------------------------------------------------------------------------
// Profese (stránky /remeslnici/<slug>)
// ---------------------------------------------------------------------------

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

/** Otázky: bloky oddělené prázdným řádkem, první řádek otázka, zbytek odpověď. */
function parseFaq(v: FormDataEntryValue | null) {
  return String(v ?? "").replace(/\r/g, "").split(/\n\s*\n/).map((b) => {
    const [q = "", ...a] = b.split("\n").map((s) => s.trim());
    return { q, a: a.join(" ").trim() };
  }).filter((f) => f.q && f.a);
}

const profession = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Adresa smí obsahovat jen malá písmena bez diakritiky, číslice a pomlčky.").min(2).max(60),
  name: z.string().trim().min(2, "Vyplňte název.").max(80),
  category: z.string().min(1, "Vyberte obor poptávek."),
  meta_title: z.string().trim().min(10, "Titulek pro Google má mít 10–90 znaků.").max(90, "Titulek pro Google má mít 10–90 znaků."),
  meta_description: z.string().trim().min(50, "Popis pro Google má mít 50–200 znaků.").max(200, "Popis pro Google má mít 50–200 znaků."),
  intro: z.string().trim().min(50, "Úvodní text má mít aspoň 50 znaků.").max(2000),
  tip: z.string().trim().max(600, "Tip může mít nejvýše 600 znaků."),
  sort: z.coerce.number().int().min(0).max(9999),
});

export async function saveProfession(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const p = profession.safeParse(Object.fromEntries(["slug", "name", "category", "meta_title", "meta_description", "intro", "tip", "sort"].map((k) => [k, form.get(k) ?? ""])));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Zkontrolujte údaje." };
  const original = String(form.get("original") ?? "") || null;
  const payload = {
    ...p.data,
    services: lines(form.get("services")).slice(0, 20),
    price_factors: lines(form.get("price_factors")).slice(0, 20),
    faq: parseFaq(form.get("faq")).slice(0, 10),
    published: form.get("published") === "on",
  };
  const { error } = await supabase.rpc("admin_save_profession", { p: payload, p_original: original });
  if (error) {
    if (error.message.includes("duplicate key")) return { error: "Profese s touto adresou už existuje." };
    return fail(error, "Profesi se nepodařilo uložit.");
  }
  revalidatePath("/remeslnici");
  revalidatePath(`/remeslnici/${p.data.slug}`);
  if (original && original !== p.data.slug) revalidatePath(`/remeslnici/${original}`);
  revalidatePath("/ssh/profese");
  if (original !== p.data.slug) redirect(`/ssh/profese/${p.data.slug}?ulozeno=1`);
  return { ok: true, message: "Uloženo. Stránka se na webu obnoví do 5 minut." };
}

export async function deleteProfession(_: AdminState, form: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const slug = String(form.get("slug") ?? "");
  if (form.get("confirm") !== "on") return { error: "Potvrďte smazání zaškrtnutím." };
  const { error } = await supabase.rpc("admin_delete_profession", { p_slug: slug });
  if (error) return fail(error, "Profesi se nepodařilo smazat.");
  revalidatePath("/remeslnici");
  revalidatePath(`/remeslnici/${slug}`);
  revalidatePath("/ssh/profese");
  redirect("/ssh/profese");
}
