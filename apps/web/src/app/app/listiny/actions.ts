"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/data";
import { todayInPrague } from "@/lib/calendar";
import { insertAndIssue, type CreateResult } from "@/lib/documents/issue";
import { loadListinaContext } from "@/lib/documents/listiny";
import { buildListina, ListinaError, listinaTotal, type ListinaInput, type ListinaType } from "@/lib/documents/extra";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const party = z.object({
  name: z.string().trim().max(200), ico: z.string().trim().max(12).nullish(), dic: z.string().trim().max(14).nullish(),
  street: z.string().trim().max(200).nullish(), city: z.string().trim().max(100).nullish(), zip: z.string().trim().max(10).nullish(),
});
const rate = z.union([z.literal(0), z.literal(12), z.literal(21)]).nullable();
const inputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delivery"), title: z.string().max(200), showPrices: z.boolean(), note: z.string().max(2000) }),
  z.object({ type: z.enum(["cash_in", "cash_out"]), counterparty: party, amount: z.number().int(), purpose: z.string().max(300), vatRate: rate, relatedNumber: z.string().max(40).nullable() }),
  z.object({ type: z.literal("reminder"), level: z.enum(["reminder", "final"]), newDueDate: date, note: z.string().max(2000) }),
  z.object({ type: z.literal("claim"), subject: z.string().max(300), defect: z.string().max(3000), claimedOn: date, requestedRemedy: z.string().max(300), consumer: z.boolean() }),
  z.object({ type: z.literal("amendment"), scope: z.string().max(3000), priceNet: z.number().int().nullable(), dateFrom: date.nullable(), dateTo: date.nullable(), reason: z.string().max(1000) }),
]);

/** Vystaví listinu: podklady načte znovu ze systému, z formuláře převezme jen to, co uživatel zadal. */
export async function createListina(type: ListinaType, ids: { jobId: string | null; docId: string | null }, raw: ListinaInput): Promise<CreateResult> {
  const company = await requireStaff();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success || (parsed.data.type !== type)) return { ok: false, error: "Zkontrolujte údaje." };
  const ctx = await loadListinaContext(company, type, ids);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  let snapshot;
  try {
    snapshot = buildListina(ctx, parsed.data as ListinaInput, todayInPrague());
  } catch (e) {
    return { ok: false, error: e instanceof ListinaError ? e.message : "Listinu se nepodařilo připravit." };
  }
  const res = await insertAndIssue(company, {
    type,
    job_id: ctx.jobId,
    client_id: type.startsWith("cash") ? ctx.clientId : ctx.clientId,
    related_document_id: ctx.relatedId,
    vat_mode: ctx.vatPayer ? ctx.vatMode : "non_payer",
    total_due: (listinaTotal(snapshot) / 100).toFixed(2),
    snapshot,
  });
  if (res.ok) {
    if (ctx.jobId) revalidatePath(`/app/zakazky/${ctx.jobId}`);
    if (ctx.relatedId) revalidatePath(`/app/doklady/${ctx.relatedId}`);
    revalidatePath("/app/listiny");
  }
  return res;
}
