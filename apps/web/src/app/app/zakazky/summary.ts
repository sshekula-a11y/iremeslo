import { summarizeJob, type Job } from "@iremeslo/core";
import { parseInput } from "@/lib/money";
import type { JobDraft } from "./types";

/** Formulář → vstup pro výpočetní jádro (stejné vzorce jako v testech a kontrolním příkladu). */
export function draftToJob(d: JobDraft, minMarginPct: string): Job {
  const opt = (s: string) => (s.trim() === "" ? null : parseInput(s));
  return {
    work: d.work.map((w) => ({ description: w.description, qty: parseInput(w.qty), unit: w.unit, unitPrice: parseInput(w.unitPrice) })),
    materials: d.materials.map((m) => ({
      description: m.description,
      qtyPlanned: parseInput(m.qty),
      qtyActual: opt(m.qtyActual),
      unit: m.unit,
      purchasePrice: parseInput(m.purchasePrice),
      salePrice: parseInput(m.salePrice),
      billable: m.billable,
    })),
    labor: d.labor.map((l) => ({
      name: l.employeeId,
      employeeId: l.employeeId,
      qtyPlanned: parseInput(l.qty),
      qtyActual: opt(l.qtyActual),
      unit: l.unit,
      rate: parseInput(l.rate),
    })),
    expenses: d.expenses.map((e) => ({
      description: e.description,
      qtyPlanned: parseInput(e.qty),
      qtyActual: opt(e.qtyActual),
      unitPrice: parseInput(e.unitPrice),
    })),
    discount:
      d.discountKind === "percent"
        ? { kind: "percent", bp: Math.min(10_000, Math.max(0, parseInput(d.discountValue))) }
        : d.discountKind === "amount"
          ? { kind: "amount", amount: Math.max(0, parseInput(d.discountValue)) }
          : null,
    vatMode: d.vatMode,
    vatRate: d.vatRate,
    minMarginBp: parseInput(minMarginPct),
  };
}

export function safeSummary(d: JobDraft, minMarginPct: string) {
  try {
    return { summary: summarizeJob(draftToJob(d, minMarginPct)), error: null as string | null };
  } catch (e) {
    return { summary: null, error: e instanceof Error ? e.message : "Chyba výpočtu" };
  }
}
