"use server";

import type { InvoiceSnapshot } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DOC_STATUS_LABELS, DOC_TYPE_LABELS, INVOICE_TYPES, loadDocument } from "@/lib/documents/load";
import { buildIsdoc, type IsdocInput } from "@/lib/documents/isdoc";
import type { DocumentView } from "@/lib/documents/view";

export interface ExportItem { file: string; view: DocumentView; isdoc: string }
export type ExportResult = { ok: true; items: ExportItem[]; csv: string } | { ok: false; error: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX = 300;

/** Podklady pro účetní za období (podle data vystavení): pro každý doklad pohled pro PDF a ISDOC XML, k tomu přehled CSV. */
export async function accountingExport(from: string, to: string): Promise<ExportResult> {
  const company = await requireStaff();
  if (!ISO.test(from) || !ISO.test(to) || from > to) return { ok: false, error: "Zadejte platné období." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, type, number, status, issue_date, taxable_date, due_date, snapshot")
    .eq("company_id", company.id)
    .in("type", [...INVOICE_TYPES])
    .not("number", "is", null)
    .gte("issue_date", from)
    .lte("issue_date", to)
    .order("issue_date")
    .order("number")
    .limit(MAX + 1);
  if (error) return { ok: false, error: "Doklady se nepodařilo načíst." };
  if (!data?.length) return { ok: false, error: "V tomto období nemáte žádný vystavený doklad." };
  if (data.length > MAX) return { ok: false, error: `V období je víc než ${MAX} dokladů. Zvolte kratší období.` };

  const items: ExportItem[] = [];
  const rows: string[][] = [["Číslo", "Druh", "Datum vystavení", "DUZP", "Splatnost", "Odběratel", "IČO", "DIČ", "Základ", "DPH", "Celkem", "K úhradě", "Stav"]];
  for (const d of data) {
    const doc = await loadDocument(company.id, d.id);
    const s = d.snapshot as InvoiceSnapshot;
    const input: IsdocInput = {
      id: d.id, type: d.type as IsdocInput["type"], number: d.number!, issueDate: d.issue_date!,
      taxableDate: d.taxable_date, dueDate: d.due_date, snapshot: s,
    };
    const safe = d.number!.replace(/[^\w-]+/g, "-");
    items.push({ file: safe, view: doc.view, isdoc: buildIsdoc(input) });
    const base = s.recap.reduce((a, r) => a + r.base, 0);
    const vat = s.recap.reduce((a, r) => a + r.vat, 0);
    const kc = (h: number) => (h / 100).toFixed(2).replace(".", ",");
    rows.push([d.number!, DOC_TYPE_LABELS[d.type] ?? d.type, d.issue_date ?? "", d.taxable_date ?? "", d.due_date ?? "",
      s.customer.name, s.customer.ico ?? "", s.customer.dic ?? "",
      kc(s.recap.length ? base : s.total), kc(vat), kc(s.total), kc(s.amountDue), DOC_STATUS_LABELS[d.status] ?? d.status]);
  }
  // CSV pro Excel: středníky a BOM, aby se čeština a sloupce načetly správně.
  const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
  return { ok: true, items, csv };
}
