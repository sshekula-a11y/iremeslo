import { test } from "node:test";
import assert from "node:assert/strict";
import { kc, q, summarizeJob, planVsActual, salePriceFromMarkup, formatCzk, formatPercent, type Job } from "../src/index.ts";

/** Kontrolní příklad ze zadání (sekce Výpočty). Musí dát přesně uvedené částky. */
function kontrolniPriklad(): Job {
  return {
    work: [{ description: "Čištění + nátěr střechy", qty: q(180), unit: "m²", unitPrice: kc(250) }],
    materials: [
      { description: "Barva", qtyPlanned: q(60), unit: "l", purchasePrice: kc(160), salePrice: kc(220), billable: true },
    ],
    labor: [
      { name: "Pracovník 1", qtyPlanned: q(3), unit: "den", rate: kc(2500) },
      { name: "Pracovník 2", qtyPlanned: q(3), unit: "den", rate: kc(2500) },
    ],
    expenses: [
      { description: "Plošina", qtyPlanned: q(3), unitPrice: kc(3000) },
      { description: "Doprava", qtyPlanned: q(1), unitPrice: kc(1800) },
    ],
    vatMode: "standard",
    vatRate: 12,
  };
}

test("kontrolní příklad ze zadání dá přesně uvedené částky", () => {
  const s = summarizeJob(kontrolniPriklad());
  assert.equal(s.revenue.work, kc(45_000));
  assert.equal(s.revenue.materials, kc(13_200));
  assert.equal(s.costs.materials, kc(9_600));
  assert.equal(s.costs.labor, kc(15_000));
  assert.equal(s.costs.expenses, kc(10_800));
  assert.equal(s.revenue.net, kc(58_200), "cena bez DPH");
  assert.equal(s.costs.total, kc(35_400), "náklady");
  assert.equal(s.profit, kc(22_800), "výdělek");
  assert.equal(formatPercent(s.marginBp ?? 0), "39,2 %", "marže");
  assert.equal(s.vat, kc(6_984));
  assert.equal(s.gross, kc(65_184), "cena s DPH 12 %");
  assert.equal(s.lowMargin, false);
  assert.equal(formatCzk(s.gross), "65 184,00 Kč");
});

test("materiál zahrnutý v ceně práce je jen náklad", () => {
  const job = kontrolniPriklad();
  job.materials[0]!.billable = false;
  const s = summarizeJob(job);
  assert.equal(s.revenue.net, kc(45_000));
  assert.equal(s.costs.materials, kc(9_600));
});

test("sleva v % i pevnou částkou na celou zakázku", () => {
  const job = kontrolniPriklad();
  job.discount = { kind: "percent", bp: 1000 };
  assert.equal(summarizeJob(job).revenue.net, kc(52_380));
  job.discount = { kind: "amount", amount: kc(2_200) };
  assert.equal(summarizeJob(job).revenue.net, kc(56_000));
  job.discount = { kind: "amount", amount: kc(100_000) };
  assert.throws(() => summarizeJob(job), /vyšší než cena/);
});

test("přenesená daňová povinnost a neplátce: DPH se nepřičítá", () => {
  const job = kontrolniPriklad();
  job.vatMode = "reverse_charge";
  let s = summarizeJob(job);
  assert.equal(s.vat, 0);
  assert.equal(s.vatRate, 0);
  assert.equal(s.gross, kc(58_200));
  job.vatMode = "non_payer";
  s = summarizeJob(job);
  assert.equal(s.gross, kc(58_200));
});

test("DPH 21 %", () => {
  const job = kontrolniPriklad();
  job.vatRate = 21;
  assert.equal(summarizeJob(job).gross, kc(70_422));
});

test("marže pod hranicí se označí varováním", () => {
  const job = kontrolniPriklad();
  job.work[0]!.unitPrice = kc(140); // cena 25 200 + 13 200 = 38 400, zisk 3 000 = 7,8 %
  const s = summarizeJob(job);
  assert.equal(s.lowMargin, true);
  job.minMarginBp = 500;
  assert.equal(summarizeJob(job).lowMargin, false);
});

test("plán vs. skutečnost: chybějící skutečnost se počítá plánem a hlásí", () => {
  const job = kontrolniPriklad();
  job.labor[0]!.qtyActual = q(4); // o den víc
  job.materials[0]!.qtyActual = q(55);
  const r = planVsActual(job);
  assert.equal(r.plan.costs.labor, kc(15_000));
  assert.equal(r.actual.costs.labor, kc(17_500));
  assert.equal(r.diff.labor, kc(2_500));
  assert.equal(r.actual.costs.materials, kc(8_800));
  assert.equal(r.actual.revenue.materials, kc(12_100), "účtuje se skutečná spotřeba");
  assert.equal(r.actual.missingActuals, 3);
});

test("haléře u řádků a desetinná množství", () => {
  const s = summarizeJob({
    work: [{ description: "Nátěr", qty: q(12.35), unit: "m²", unitPrice: kc(189.9) }],
    materials: [],
    labor: [],
    expenses: [],
    vatMode: "standard",
    vatRate: 21,
  });
  // 12,35 × 189,90 = 2 345,265 → 2 345,27
  assert.equal(s.revenue.net, 234_527);
  assert.equal(s.vat, 49_251); // 2 345,27 × 0,21 = 492,5067 → 492,51
});

test("prodejní cena materiálu z přirážky", () => {
  assert.equal(salePriceFromMarkup(kc(160), 3750), kc(220));
  assert.equal(salePriceFromMarkup(kc(99.9), 2000), kc(119.88));
});

test("nulová zakázka nemá marži a nespadne", () => {
  const s = summarizeJob({ work: [], materials: [], labor: [], expenses: [], vatMode: "standard", vatRate: 21 });
  assert.equal(s.marginBp, null);
  assert.equal(s.gross, 0);
});
