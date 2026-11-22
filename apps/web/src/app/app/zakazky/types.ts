import type { JobStatus } from "@/lib/labels";

/** Zakázka ve formuláři: čísla jako text (tak, jak je uživatel píše), přepočet běží v @iremeslo/core. */
export interface WorkRow { key: string; description: string; qty: string; unit: string; unitPrice: string }
export interface MaterialRow {
  key: string; description: string; qty: string; qtyActual: string; unit: string;
  purchasePrice: string; salePrice: string; billable: boolean;
}
export interface LaborRow { key: string; employeeId: string; qty: string; qtyActual: string; unit: "hod" | "den"; rate: string }
export interface ExpenseRow { key: string; description: string; qty: string; qtyActual: string; unitPrice: string }

export interface JobDraft {
  id?: string;
  number?: string;
  title: string;
  status: JobStatus;
  clientId: string;
  newClientName: string;
  newClientPhone: string;
  siteAddress: string;
  dateFrom: string;
  dateTo: string;
  vatMode: "standard" | "reverse_charge" | "non_payer";
  vatRate: 0 | 12 | 21;
  discountKind: "" | "percent" | "amount";
  discountValue: string;
  note: string;
  work: WorkRow[];
  materials: MaterialRow[];
  labor: LaborRow[];
  expenses: ExpenseRow[];
}

export interface EmployeeOption { id: string; name: string; rateHour: string; rateDay: string }
export interface ClientOption { id: string; name: string }
