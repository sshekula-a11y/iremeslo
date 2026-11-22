"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildQuote, DocumentError, toDecimalString, type Party } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { loadDraft } from "@/app/app/zakazky/load";
import { draftToJob } from "@/app/app/zakazky/summary";

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Vystaví cenovou nabídku z uložené zakázky: obsah se zamrazí do snapshotu, doklad dostane číslo
 * z řady CN a od té chvíle ho nejde změnit. Novou cenu = nová nabídka.
 */
export async function createQuote(jobId: string): Promise<CreateResult> {
  const company = await requireStaff();
  if (!z.string().uuid().safeParse(jobId).success) return { ok: false, error: "Neplatná zakázka" };
  const supabase = await createClient();

  const draft = await loadDraft(company.id, jobId);
  const [{ data: firm }, { data: client }] = await Promise.all([
    supabase
      .from("companies")
      .select("name, ico, dic, street, city, zip, email, phone, web, register_entry, vat_payer")
      .eq("id", company.id)
      .single(),
    draft.clientId
      ? supabase.from("clients").select("name, ico, dic, street, city, zip, email, phone").eq("company_id", company.id).eq("id", draft.clientId).single()
      : Promise.resolve({ data: null }),
  ]);
  if (!firm) return { ok: false, error: "Nepodařilo se načíst údaje firmy." };

  const supplier: Party = {
    name: firm.name, ico: firm.ico, dic: firm.dic, street: firm.street, city: firm.city, zip: firm.zip,
    email: firm.email, phone: firm.phone, web: firm.web, registerEntry: firm.register_entry,
  };
  const customer: Party | null = client
    ? { name: client.name, ico: client.ico, dic: client.dic, street: client.street, city: client.city, zip: client.zip, email: client.email, phone: client.phone }
    : null;

  let snapshot;
  try {
    snapshot = buildQuote({
      job: draftToJob(draft, company.minMarginPct),
      title: draft.title,
      supplier,
      customer,
      vatPayer: firm.vat_payer,
      siteAddress: draft.siteAddress,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
    });
  } catch (e) {
    return { ok: false, error: e instanceof DocumentError || e instanceof RangeError ? e.message : "Nabídku se nepodařilo spočítat." };
  }

  const user = (await supabase.auth.getClaims()).data?.claims?.sub ?? null;
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      company_id: company.id,
      job_id: jobId,
      client_id: draft.clientId || null,
      type: "quote",
      vat_mode: snapshot.vatMode,
      total_due: toDecimalString(snapshot.totals.gross),
      snapshot,
      created_by: user,
    })
    .select("id")
    .single();
  if (error || !doc) return { ok: false, error: "Nabídku se nepodařilo uložit." };

  const { error: issueError } = await supabase.rpc("issue_document", { p_document: doc.id });
  if (issueError) {
    // Koncept bez čísla nikomu nechybí; smažeme ho, ať v seznamu nestraší.
    await supabase.from("documents").delete().eq("company_id", company.id).eq("id", doc.id);
    return { ok: false, error: "Nabídku se nepodařilo vystavit: " + issueError.message };
  }

  revalidatePath(`/app/zakazky/${jobId}`);
  return { ok: true, id: doc.id };
}
