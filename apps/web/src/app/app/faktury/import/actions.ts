"use server";

import { revalidatePath } from "next/cache";
import { isValidIco } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { parseInvoiceLines, toLines, type ParsedInvoice } from "@/lib/documents/pdf-import";
import { pdfText } from "@/lib/documents/pdf-text";
import { parseIsdoc } from "@/lib/documents/isdoc-import";

export type ParseResult = { ok: true; invoice: ParsedInvoice; duplicate: boolean } | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;

/** Přečte jednu fakturu (PDF nebo ISDOC) a řekne, jestli už ve firmě je. Nic neukládá. */
export async function parseInvoiceFile(form: FormData): Promise<ParseResult> {
  const company = await requireStaff();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Chybí soubor." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Soubor je větší než 10 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let invoice: ParsedInvoice | null = null;
  try {
    if (name.endsWith(".pdf")) invoice = parseInvoiceLines(toLines((await pdfText(bytes))[0] ?? []), file.name);
    else if (name.endsWith(".isdoc") || name.endsWith(".xml")) invoice = parseIsdoc(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, error: "Soubor se nepodařilo přečíst." };
  }
  if (!invoice) return { ok: false, error: "Tohle není faktura v PDF ani ISDOC." };
  const supabase = await createClient();
  const { count } = await supabase.from("imported_invoices").select("id", { count: "exact", head: true })
    .eq("company_id", company.id).eq("kind", invoice.kind).eq("number", invoice.number);
  return { ok: true, invoice, duplicate: (count ?? 0) > 0 };
}

export type SaveResult = { ok: true; clientCreated: boolean } | { ok: false; error: string };

/** Uloží převzatou fakturu (a její PDF). Odběratele najde mezi zákazníky, jinak ho založí. */
export async function saveImportedInvoice(form: FormData): Promise<SaveResult> {
  const company = await requireStaff();
  let v: ParsedInvoice;
  try { v = JSON.parse(String(form.get("data") ?? "")); } catch { return { ok: false, error: "Neplatná data." }; }
  const number = String(v.number ?? "").trim().slice(0, 40);
  const customer = String(v.customerName ?? "").trim().slice(0, 200);
  const total = Number(v.total);
  const date = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d : null);
  let ico = String(v.customerIco ?? "").replace(/\D/g, "");
  if (ico) ico = ico.padStart(8, "0");
  if (ico && !isValidIco(ico)) ico = "";
  if (!number) return { ok: false, error: "Chybí číslo faktury." };
  if (!customer) return { ok: false, error: "Chybí odběratel." };
  if (!Number.isFinite(total)) return { ok: false, error: "Chybí částka." };

  const supabase = await createClient();
  // odběratel: podle IČO, jinak podle jména; když není, založí se
  let clientId: string | null = null;
  let clientCreated = false;
  const byIco = ico ? await supabase.from("clients").select("id").eq("company_id", company.id).eq("ico", ico).limit(1) : null;
  clientId = byIco?.data?.[0]?.id ?? null;
  if (!clientId) {
    const { data } = await supabase.from("clients").select("id").eq("company_id", company.id).ilike("name", customer).limit(1);
    clientId = data?.[0]?.id ?? null;
  }
  if (!clientId) {
    const { data, error } = await supabase.from("clients")
      .insert({ company_id: company.id, kind: ico ? "company" : "person", name: customer, ico: ico || null, marketing_consent: false })
      .select("id").single();
    if (!error && data) { clientId = data.id; clientCreated = true; }
  }

  // PDF do soukromého úložiště firmy
  let pdfPath: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.name.toLowerCase().endsWith(".pdf")) {
    if (file.size > MAX_BYTES) return { ok: false, error: "PDF je větší než 10 MB." };
    pdfPath = `${company.id}/imports/${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage.from("files").upload(pdfPath, file, { contentType: "application/pdf", upsert: false });
    if (error) return { ok: false, error: "PDF se nepodařilo uložit." };
  }

  const { error } = await supabase.from("imported_invoices").insert({
    company_id: company.id, kind: v.kind === "advance" ? "advance" : "invoice", number,
    issue_date: date(v.issueDate), due_date: date(v.dueDate), customer_name: customer, customer_ico: ico || null,
    client_id: clientId, total: total.toFixed(2), source: String(v.source ?? "").slice(0, 60) || null, pdf_path: pdfPath,
  });
  if (error) {
    if (pdfPath) await supabase.storage.from("files").remove([pdfPath]);
    return { ok: false, error: error.code === "23505" ? "Faktura s tímto číslem už je uložená." : "Fakturu se nepodařilo uložit." };
  }
  revalidatePath("/app/faktury");
  return { ok: true, clientCreated };
}

/** Odkaz na PDF převzaté faktury (platí 10 minut). */
export async function importedPdfUrl(id: string): Promise<string | null> {
  const company = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("imported_invoices").select("pdf_path").eq("company_id", company.id).eq("id", id).single();
  if (!data?.pdf_path) return null;
  const { data: s } = await supabase.storage.from("files").createSignedUrl(data.pdf_path, 600);
  return s?.signedUrl ?? null;
}
