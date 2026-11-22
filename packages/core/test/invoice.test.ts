import { test } from "node:test";
import assert from "node:assert/strict";
import { kc, q, computeInvoice, advanceAmount, ddppFromPayment, ddppDeadline, vatFromGross, InvoiceError } from "../src/index.ts";

const lines = [
  { description: "Čištění střechy", qty: q(180), unit: "m²", unitPrice: kc(250), vatRate: 21 as const },
  { description: "Barva", qty: q(60), unit: "l", unitPrice: kc(220), vatRate: 21 as const },
];

test("faktura plátce: rekapitulace DPH", () => {
  const t = computeInvoice({ mode: "standard", lines });
  assert.equal(t.subtotal, kc(58_200));
  assert.deepEqual(t.recap, [{ rate: 21, base: kc(58_200), vat: kc(12_222), total: kc(70_422) }]);
  assert.equal(t.amountDue, kc(70_422));
  assert.deepEqual(t.notes, []);
});

test("smíšené sazby 21 % a 12 % jdou do rekapitulace zvlášť", () => {
  const t = computeInvoice({
    mode: "standard",
    lines: [
      { description: "Práce byt", qty: q(10), unit: "hod", unitPrice: kc(500), vatRate: 12 },
      { description: "Materiál", qty: q(1), unit: "ks", unitPrice: kc(1000), vatRate: 21 },
    ],
  });
  assert.deepEqual(
    t.recap.map((r) => [r.rate, r.base, r.vat]),
    [
      [21, kc(1000), kc(210)],
      [12, kc(5000), kc(600)],
    ],
  );
  assert.equal(t.amountDue, kc(6810));
});

test("sleva % na celou fakturu se uplatní v každé sazbě", () => {
  const t = computeInvoice({
    mode: "standard",
    discountBp: 1000,
    lines: [
      { description: "Práce", qty: q(1), unit: "paušál", unitPrice: kc(10_000), vatRate: 12 },
      { description: "Materiál", qty: q(1), unit: "ks", unitPrice: kc(333.33), vatRate: 21 },
    ],
  });
  assert.equal(t.discount, kc(1_000) + kc(33.33));
  assert.equal(t.recap.find((r) => r.rate === 12)?.base, kc(9_000));
  assert.equal(t.recap.find((r) => r.rate === 21)?.base, kc(300));
});

test("přenesená daňová povinnost: 0 % a povinný text", () => {
  const t = computeInvoice({ mode: "reverse_charge", lines });
  assert.equal(t.amountDue, kc(58_200));
  assert.equal(t.recap[0]?.rate, 0);
  assert.deepEqual(t.notes, ["Daň odvede zákazník"]);
});

test("neplátce: bez DPH a s textem", () => {
  const t = computeInvoice({ mode: "non_payer", lines });
  assert.equal(t.amountDue, kc(58_200));
  assert.equal(t.recap[0]?.vat, 0);
  assert.deepEqual(t.notes, ["Nejsem plátce DPH"]);
});

test("záloha 30 % a DDPP: DPH z přijaté částky", () => {
  const zaloha = advanceAmount(kc(70_422), { percentBp: 3000 });
  assert.equal(zaloha, kc(21_126.6));
  const dd = ddppFromPayment(kc(9_000), 21);
  assert.equal(dd.vat, kc(1_561.98));
  assert.equal(dd.base, kc(7_438.02));
  assert.equal(ddppDeadline("2026-11-20"), "2026-12-05");
});

test("odečet zaplacené zálohy na ostré faktuře snižuje základ, DPH i úhradu", () => {
  const t = computeInvoice({
    mode: "standard",
    lines,
    deductions: [{ advanceNumber: "ZF-2026-012", ddppNumber: "DD-2026-007", status: "paid", paidGross: kc(9_000), vatRate: 21 }],
  });
  assert.equal(t.deductions[0]?.label, "Odečet zálohy ZF-2026-012 (DDPP DD-2026-007)");
  assert.equal(t.deductions[0]?.base, -kc(7_438.02));
  assert.equal(t.deductions[0]?.vat, -kc(1_561.98));
  const r = t.recapAfterDeductions[0]!;
  assert.equal(r.base, kc(58_200) - kc(7_438.02));
  assert.equal(r.vat, kc(12_222) - kc(1_561.98));
  assert.equal(t.amountDue, kc(70_422) - kc(9_000));
});

test("pravidla odečtu: nezaplacená, už vyúčtovaná, dvakrát, víc než faktura", () => {
  const base = { mode: "standard" as const, lines };
  const z = { advanceNumber: "ZF-1", status: "paid" as const, paidGross: kc(1_000), vatRate: 21 as const };
  assert.throws(() => computeInvoice({ ...base, deductions: [{ ...z, status: "issued" }] }), /není zaplacená/);
  assert.throws(() => computeInvoice({ ...base, deductions: [{ ...z, status: "settled" }] }), /už byla vyúčtována/);
  assert.throws(() => computeInvoice({ ...base, deductions: [z, z] }), /dvakrát/);
  assert.throws(() => computeInvoice({ ...base, deductions: [{ ...z, paidGross: kc(100_000) }] }), InvoiceError);
  assert.throws(() => computeInvoice({ ...base, deductions: [{ ...z, vatRate: 12 }] }), /sazbě 12 %/);
});

test("neplátce: záloha se odečte celou částkou", () => {
  const t = computeInvoice({
    mode: "non_payer",
    lines,
    deductions: [{ advanceNumber: "ZF-2026-003", status: "paid", paidGross: kc(20_000), vatRate: 21 }],
  });
  assert.equal(t.amountDue, kc(38_200));
});

test("zaokrouhlení celkem k úhradě na koruny", () => {
  const t = computeInvoice({
    mode: "standard",
    roundTotal: true,
    lines: [{ description: "X", qty: q(1), unit: "ks", unitPrice: kc(100.4), vatRate: 21 }],
  });
  assert.equal(t.amountBeforeRounding, kc(121.48));
  assert.equal(t.amountDue, kc(121));
  assert.equal(t.rounding, -48);
});

test("DPH zdola: součet základu a daně vždy sedí na přijatou částku", () => {
  for (let h = 1; h < 200_000; h += 997) {
    for (const rate of [21, 12] as const) {
      const r = vatFromGross(h, rate);
      assert.equal(r.base + r.vat, h);
    }
  }
});
