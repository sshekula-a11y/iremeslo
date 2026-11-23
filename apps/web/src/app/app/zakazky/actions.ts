"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fromHundredths, parseInput } from "@/lib/money";
import type { JobDraft } from "./types";

const num = (s: string) => fromHundredths(parseInput(s));
const optNum = (s: string) => (s.trim() === "" ? "" : num(s));

const draftSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Vyplňte název zakázky").max(200),
  status: z.enum(["inquiry", "quote_sent", "approved", "in_progress", "done", "invoiced", "paid", "rejected"]),
  clientId: z.string(),
  newClientName: z.string().trim().max(200),
  newClientPhone: z.string().trim().max(40),
  siteAddress: z.string().trim().max(300),
  dateFrom: z.string(),
  dateTo: z.string(),
  vatMode: z.enum(["standard", "reverse_charge", "non_payer"]),
  vatRate: z.union([z.literal(0), z.literal(12), z.literal(21)]),
  discountKind: z.enum(["", "percent", "amount"]),
  discountValue: z.string(),
  note: z.string().max(4000),
  work: z.array(z.object({ description: z.string().max(300), qty: z.string(), unit: z.string().max(12), unitPrice: z.string() })).max(200),
  materials: z
    .array(
      z.object({
        description: z.string().max(300), qty: z.string(), qtyActual: z.string(), unit: z.string().max(12),
        purchasePrice: z.string(), salePrice: z.string(), billable: z.boolean(),
      }),
    )
    .max(200),
  labor: z.array(z.object({ employeeId: z.string().uuid("Vyberte pracovníka"), qty: z.string(), qtyActual: z.string(), unit: z.enum(["hod", "den"]), rate: z.string() })).max(100),
  expenses: z.array(z.object({ description: z.string().max(300), qty: z.string(), qtyActual: z.string(), unitPrice: z.string() })).max(200),
});

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveJob(draft: JobDraft): Promise<SaveResult> {
  const company = await requireStaff();
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neplatná data" };
  const d = parsed.data;
  if (d.dateFrom && d.dateTo && d.dateTo < d.dateFrom) return { ok: false, error: "Datum „do“ nesmí být dřívější než „od“." };

  const payload = {
    id: d.id ?? "",
    title: d.title,
    status: d.status,
    client_id: d.clientId,
    new_client_name: d.clientId ? "" : d.newClientName,
    new_client_phone: d.newClientPhone,
    site_address: d.siteAddress,
    date_from: d.dateFrom,
    date_to: d.dateTo,
    vat_mode: d.vatMode,
    vat_rate: d.vatMode === "standard" ? d.vatRate : 0,
    discount_kind: d.discountKind,
    discount_value: d.discountKind ? num(d.discountValue) : "",
    note: d.note,
    work: d.work
      .filter((w) => w.description.trim() || parseInput(w.qty))
      .map((w) => ({ description: w.description.trim() || "Práce", qty: num(w.qty), unit: w.unit, unit_price: num(w.unitPrice) })),
    materials: d.materials
      .filter((m) => m.description.trim() || parseInput(m.qty))
      .map((m) => ({
        description: m.description.trim() || "Materiál", qty_planned: num(m.qty), qty_actual: optNum(m.qtyActual), unit: m.unit,
        purchase_price: num(m.purchasePrice), sale_price: num(m.salePrice), billable: m.billable,
      })),
    labor: d.labor.map((l) => ({ employee_id: l.employeeId, qty_planned: num(l.qty), qty_actual: optNum(l.qtyActual), unit: l.unit, rate: num(l.rate) })),
    expenses: d.expenses
      .filter((e) => e.description.trim() || parseInput(e.unitPrice))
      .map((e) => ({ description: e.description.trim() || "Výdaj", qty_planned: num(e.qty), qty_actual: optNum(e.qtyActual), unit_price: num(e.unitPrice) })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_job", { p_company: company.id, p_job: payload });
  if (error) return { ok: false, error: "Zakázku se nepodařilo uložit: " + error.message };
  revalidatePath("/app/zakazky");
  revalidatePath("/app");
  return { ok: true, id: String(data) };
}
