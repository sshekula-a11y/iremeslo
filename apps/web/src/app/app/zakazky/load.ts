import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toHundredths, toInput } from "@/lib/money";
import type { ActiveCompany } from "@/lib/data";
import type { ClientOption, EmployeeOption, JobDraft } from "./types";
import type { JobStatus } from "@/lib/labels";

const t = (v: string | number | null | undefined) => toInput(toHundredths(v));
const tOpt = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : toInput(toHundredths(v)) || "0");

export async function loadOptions(companyId: string): Promise<{ clients: ClientOption[]; employees: EmployeeOption[] }> {
  const supabase = await createClient();
  const [{ data: clients }, { data: employees }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("company_id", companyId).order("name"),
    supabase.from("employees").select("id, name, rate_hour, rate_day").eq("company_id", companyId).eq("active", true).order("name"),
  ]);
  return {
    clients: (clients ?? []).map((c) => ({ id: c.id, name: c.name })),
    employees: (employees ?? []).map((e) => ({ id: e.id, name: e.name, rateHour: String(e.rate_hour), rateDay: String(e.rate_day) })),
  };
}

export function emptyDraft(company: ActiveCompany): JobDraft {
  return {
    title: "",
    status: "inquiry",
    clientId: "",
    newClientName: "",
    newClientPhone: "",
    siteAddress: "",
    dateFrom: "",
    dateTo: "",
    vatMode: company.vatPayer ? "standard" : "non_payer",
    vatRate: company.vatPayer ? (company.defaultVatRate === 12 ? 12 : 21) : 0,
    discountKind: "",
    discountValue: "",
    note: "",
    work: [{ key: "w0", description: "", qty: "", unit: "m²", unitPrice: "" }],
    materials: [],
    labor: [],
    expenses: [],
  };
}

export async function loadDraft(companyId: string, jobId: string): Promise<JobDraft> {
  const supabase = await createClient();
  const { data: j } = await supabase
    .from("jobs")
    .select(
      "id, number, title, status, client_id, site_address, date_from, date_to, vat_mode, vat_rate, discount_kind, discount_value, note," +
        "job_work_items(id, position, description, qty, unit, unit_price)," +
        "job_materials(id, position, description, qty_planned, qty_actual, unit, purchase_price, sale_price, billable)," +
        "job_labor(id, position, employee_id, qty_planned, qty_actual, unit, rate)," +
        "job_expenses(id, position, description, qty_planned, qty_actual, unit_price)",
    )
    .eq("company_id", companyId)
    .eq("id", jobId)
    .maybeSingle();
  if (!j) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = j as any;
  const byPos = (a: { position: number }, b: { position: number }) => a.position - b.position;

  return {
    id: job.id,
    number: job.number,
    title: job.title,
    status: job.status as JobStatus,
    clientId: job.client_id ?? "",
    newClientName: "",
    newClientPhone: "",
    siteAddress: job.site_address ?? "",
    dateFrom: job.date_from ?? "",
    dateTo: job.date_to ?? "",
    vatMode: job.vat_mode,
    vatRate: job.vat_rate,
    discountKind: job.discount_kind ?? "",
    discountValue: job.discount_value === null ? "" : t(job.discount_value),
    note: job.note ?? "",
    work: [...job.job_work_items].sort(byPos).map((w: any) => ({ key: w.id, description: w.description, qty: t(w.qty), unit: w.unit, unitPrice: t(w.unit_price) })),
    materials: [...job.job_materials].sort(byPos).map((m: any) => ({
      key: m.id, description: m.description, qty: t(m.qty_planned), qtyActual: tOpt(m.qty_actual), unit: m.unit,
      purchasePrice: t(m.purchase_price), salePrice: t(m.sale_price), billable: m.billable,
    })),
    labor: [...job.job_labor].sort(byPos).map((l: any) => ({
      key: l.id, employeeId: l.employee_id, qty: t(l.qty_planned), qtyActual: tOpt(l.qty_actual), unit: l.unit, rate: t(l.rate),
    })),
    expenses: [...job.job_expenses].sort(byPos).map((e: any) => ({
      key: e.id, description: e.description, qty: t(e.qty_planned), qtyActual: tOpt(e.qty_actual), unitPrice: t(e.unit_price),
    })),
  };
}
