"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { AiError, withAiQuota } from "@/lib/ai/claude";
import { extractReceipt } from "@/lib/ai/receipt";
import { EXPENSE_CATEGORIES, PAID_METHODS } from "@/lib/expenses";
import { parseReceiptText, type ReceiptGuess } from "@iremeslo/core";
import { lookupAres } from "@/lib/ares";
import { toLines } from "@/lib/documents/pdf-import";
import { pdfText } from "@/lib/documents/pdf-text";
import { todayInPrague } from "@/lib/calendar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA: Record<string, "image/jpeg" | "image/png" | "image/webp" | "application/pdf"> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export interface ExpenseFields {
  kind: "receipt" | "invoice";
  supplierName: string;
  supplierIco: string;
  docNumber: string;
  issueDate: string;
  total: string;
  vatBase: string;
  vat: string;
  currency: string;
  category: string;
  description: string;
  paidMethod: string;
  jobId: string;
}

const isoDate = (s: string | null | undefined) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? "" : s;
};
const money = (n: number | null | undefined) => (n == null || !Number.isFinite(n) || n < 0 ? "" : n.toFixed(2).replace(".", ","));

/** Pošle nahranou účtenku AI a vrátí předvyplněná pole formuláře (uživatel je před uložením zkontroluje). */
export async function readReceipt(path: string): Promise<{ ok: true; fields: Partial<ExpenseFields>; note: string; readable: boolean } | { ok: false; error: string }> {
  const company = await requireStaff();
  const m = path.match(new RegExp(`^${company.id}/expenses/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`));
  if (!m) return { ok: false, error: "Neplatný soubor." };
  const supabase = await createClient();
  const { data: blob, error } = await supabase.storage.from("files").download(path);
  if (error || !blob) return { ok: false, error: "Soubor se nepodařilo načíst." };
  if (blob.size > 10 * 1024 * 1024) return { ok: false, error: "Soubor je příliš velký (nejvýš 10 MB)." };
  const bytes = Buffer.from(await blob.arrayBuffer());

  try {
    const r = await withAiQuota(company.id, "receipt", () => extractReceipt(bytes, MEDIA[m[1]]));
    const ico = (r.supplier_ico ?? "").replace(/\D/g, "");
    return {
      ok: true,
      readable: r.readable,
      note: r.note,
      fields: {
        kind: r.kind,
        supplierName: r.supplier_name.slice(0, 200),
        supplierIco: ico.length >= 6 && ico.length <= 8 ? ico.padStart(8, "0") : "",
        docNumber: (r.doc_number ?? "").slice(0, 60),
        issueDate: isoDate(r.issue_date),
        total: money(r.total),
        vatBase: money(r.vat_base),
        vat: money(r.vat),
        currency: /^[A-Z]{3}$/.test(r.currency) ? r.currency : "CZK",
        category: r.category,
        description: r.description.slice(0, 500),
        paidMethod: r.paid_method,
      },
    };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    console.error("readReceipt", e);
    return { ok: false, error: "AI doklad nepřečetla. Údaje zadejte ručně." };
  }
}

const num = (req: boolean) => z.string().trim().transform((s) => s.replace(/\s/g, "").replace(",", ".")).refine((s) => (req ? s !== "" : true) && (s === "" || /^\d{1,8}(\.\d{1,2})?$/.test(s)), "částka");

const Schema = z.object({
  kind: z.enum(["receipt", "invoice"]),
  supplierName: z.string().trim().min(1, "dodavatel").max(200),
  supplierIco: z.string().trim().refine((s) => s === "" || /^\d{8}$/.test(s), "IČO"),
  docNumber: z.string().trim().max(60),
  issueDate: z.string().refine((s) => isoDate(s) !== "", "datum"),
  total: num(true),
  vatBase: num(false),
  vat: num(false),
  currency: z.string().regex(/^[A-Z]{3}$/),
  category: z.enum(EXPENSE_CATEGORIES.map(([k]) => k) as [string, ...string[]]),
  description: z.string().trim().max(500),
  paidMethod: z.enum(PAID_METHODS.map(([k]) => k) as [string, ...string[]]),
  jobId: z.string().refine((s) => s === "" || UUID.test(s)),
});

const LABELS: Record<string, string> = { dodavatel: "Vyplňte dodavatele.", "IČO": "IČO má 8 číslic.", datum: "Vyplňte datum dokladu.", "částka": "Zkontrolujte částky." };

export async function saveExpense(id: string | null, input: ExpenseFields, filePath: string | null, source: "manual" | "ai"): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const company = await requireStaff();
  const p = Schema.safeParse(input);
  if (!p.success) return { ok: false, error: LABELS[p.error.issues[0]?.message ?? ""] ?? "Zkontrolujte vyplněné údaje." };
  if (filePath && !new RegExp(`^${company.id}/expenses/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(filePath)) return { ok: false, error: "Neplatný soubor." };
  if (id && !UUID.test(id)) return { ok: false, error: "Neplatný výdaj." };
  const d = p.data;
  const row = {
    company_id: company.id, kind: d.kind, supplier_name: d.supplierName, supplier_ico: d.supplierIco || null, doc_number: d.docNumber || null,
    issue_date: d.issueDate, total: d.total, vat_base: d.vatBase || null, vat: d.vat || null, currency: d.currency, category: d.category,
    description: d.description || null, paid_method: d.paidMethod, job_id: d.jobId || null,
  };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("expenses").update({ ...row, ...(filePath ? { file_path: filePath } : {}) }).eq("company_id", company.id).eq("id", id);
    if (error) return { ok: false, error: error.message.includes("jen pro čtení") ? "Účet je v režimu jen pro čtení." : "Výdaj se nepodařilo uložit." };
    revalidatePath("/app/vydaje");
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("expenses").insert({ ...row, file_path: filePath, source, created_by: (await supabase.auth.getUser()).data.user?.id ?? null }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message.includes("jen pro čtení") ? "Účet je v režimu jen pro čtení." : "Výdaj se nepodařilo uložit." };
  revalidatePath("/app/vydaje");
  return { ok: true, id: data.id };
}

export async function deleteExpense(id: string): Promise<{ ok: boolean; error?: string }> {
  const company = await requireStaff();
  if (!UUID.test(id)) return { ok: false, error: "Neplatný výdaj." };
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").delete().eq("company_id", company.id).eq("id", id).select("file_path").maybeSingle();
  if (!data) return { ok: false, error: "Výdaj se nepodařilo smazat." };
  if (data.file_path) await supabase.storage.from("files").remove([data.file_path]);
  revalidatePath("/app/vydaje");
  return { ok: true };
}

/** Úklid: soubor nahraný k výdaji, který se nakonec neuložil. */
export async function discardUpload(path: string): Promise<void> {
  const company = await requireStaff();
  if (!new RegExp(`^${company.id}/expenses/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(path)) return;
  const supabase = await createClient();
  const { count } = await supabase.from("expenses").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("file_path", path);
  if (!count) await supabase.storage.from("files").remove([path]);
}

export async function expenseFileUrl(id: string): Promise<string | null> {
  const company = await requireStaff();
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("file_path").eq("company_id", company.id).eq("id", id).maybeSingle();
  if (!data?.file_path) return null;
  const { data: s } = await supabase.storage.from("files").createSignedUrl(data.file_path, 300);
  return s?.signedUrl ?? null;
}


/** Odhad z textu dokladu → pole formuláře (společné pro PDF na serveru i fotku přečtenou v telefonu). */
function guessToFields(g: ReceiptGuess): Partial<ExpenseFields> {
  const f: Partial<ExpenseFields> = { kind: g.kind };
  if (g.supplierIco) f.supplierIco = g.supplierIco;
  if (g.docNumber) f.docNumber = g.docNumber.slice(0, 60);
  if (g.issueDate) f.issueDate = g.issueDate;
  if (g.total !== null) f.total = money(g.total);
  if (g.vatBase !== null) f.vatBase = money(g.vatBase);
  if (g.vat !== null) f.vat = money(g.vat);
  if (g.paidMethod) f.paidMethod = g.paidMethod;
  if (g.category) f.category = g.category;
  return f;
}

/** Název dodavatele z ARES podle IČO (když ARES neodpovídá, pole zůstane prázdné). */
export async function supplierFromIco(ico: string): Promise<{ name: string | null }> {
  await requireStaff();
  if (!/^\d{8}$/.test(ico)) return { name: null };
  const r = await lookupAres(ico);
  return { name: r.ok ? r.company.name : null };
}

/**
 * Čtení dokladu bez AI: PDF přečte server (text z PDF je přesný), fotku čte telefon sám
 * (rozpoznání textu v prohlížeči) a sem pošle jen text. Výsledek doplní název dodavatele z ARES.
 */
export async function readReceiptLocal(input: { path?: string; text?: string }): Promise<{ ok: true; fields: Partial<ExpenseFields>; found: string[] } | { ok: false; error: string }> {
  const company = await requireStaff();
  let text = typeof input.text === "string" ? input.text.slice(0, 20000) : "";
  if (input.path) {
    const m = input.path.match(new RegExp(`^${company.id}/expenses/[0-9a-f-]{36}\\.pdf$`));
    if (!m) return { ok: false, error: "Neplatný soubor." };
    const supabase = await createClient();
    const { data: blob } = await supabase.storage.from("files").download(input.path);
    if (!blob) return { ok: false, error: "Soubor se nepodařilo načíst." };
    try {
      const pages = await pdfText(new Uint8Array(await blob.arrayBuffer()), 2);
      text = pages.map((items) => toLines(items).map((l) => l.text).join("\n")).join("\n");
    } catch {
      return { ok: false, error: "PDF se nepodařilo přečíst." };
    }
    if (text.replace(/\s/g, "").length < 20) return { ok: false, error: "PDF je naskenovaný obrázek bez textu – údaje vyplňte ručně, nebo nahrajte fotku." };
  }
  if (!text.trim()) return { ok: false, error: "Na dokladu se nepodařilo přečíst text." };
  const guess = parseReceiptText(text, todayInPrague(), company.ico);
  const fields = guessToFields(guess);
  if (guess.supplierIco) {
    const r = await lookupAres(guess.supplierIco);
    if (r.ok) fields.supplierName = r.company.name.slice(0, 200);
  }
  // ARES neodpověděl nebo IČO chybí: název z textu dokladu
  if (!fields.supplierName && guess.supplierName) fields.supplierName = guess.supplierName;
  return { ok: true, fields, found: guess.found };
}
