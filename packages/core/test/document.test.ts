import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuote, kc, q, summarizeJob, type Job } from "../src/index.ts";

const supplier = { name: "Malíř Novák", ico: "12345679", city: "Brno" };

function job(): Job {
  return {
    work: [{ description: "Čištění + nátěr střechy", qty: q(180), unit: "m²", unitPrice: kc(250) }],
    materials: [
      { description: "Barva", qtyPlanned: q(60), unit: "l", purchasePrice: kc(160), salePrice: kc(220), billable: true },
      { description: "Páska", qtyPlanned: q(5), unit: "ks", purchasePrice: kc(40), salePrice: kc(60), billable: false },
    ],
    labor: [{ name: "Pracovník 1", qtyPlanned: q(3), unit: "den", rate: kc(2500) }],
    expenses: [{ description: "Plošina", qtyPlanned: q(3), unitPrice: kc(3000) }],
    vatMode: "standard",
    vatRate: 12,
  };
}

test("nabídka sedí se souhrnem zakázky (kontrolní příklad)", () => {
  const quote = buildQuote({ job: job(), title: "Střecha", supplier, customer: null, vatPayer: true });
  assert.equal(quote.totals.net, kc(58_200));
  assert.equal(quote.totals.vat, kc(6_984));
  assert.equal(quote.totals.gross, kc(65_184));
  assert.equal(quote.totals.gross, summarizeJob(job()).gross);
  assert.equal(quote.lines.reduce((s, l) => s + l.total, 0), quote.totals.subtotal);
});

test("zákazník nevidí náklady: materiál jen účtovaný, žádní lidé ani výdaje", () => {
  const quote = buildQuote({ job: job(), title: "Střecha", supplier, customer: null, vatPayer: true });
  assert.deepEqual(quote.lines.map((l) => l.description), ["Čištění + nátěr střechy", "Barva"]);
  assert.ok(!JSON.stringify(quote).includes("160"), "nákupní cena v nabídce není");
});

test("sleva a režimy DPH", () => {
  const j = job();
  j.discount = { kind: "percent", bp: 1000 };
  const withDiscount = buildQuote({ job: j, title: "x", supplier, customer: null, vatPayer: true });
  assert.equal(withDiscount.totals.discount, kc(5_820));
  assert.equal(withDiscount.totals.net, kc(52_380));

  j.vatMode = "reverse_charge";
  const rc = buildQuote({ job: j, title: "x", supplier, customer: null, vatPayer: true });
  assert.equal(rc.totals.vat, 0);
  assert.deepEqual(rc.notes, ["Daň odvede zákazník"]);

  const np = buildQuote({ job: job(), title: "x", supplier, customer: null, vatPayer: false });
  assert.equal(np.totals.vat, 0);
  assert.equal(np.totals.gross, np.totals.net);
  assert.equal(np.vatMode, "non_payer");
  assert.deepEqual(np.notes, ["Nejsem plátce DPH"]);
});

test("prázdné řádky se vynechají, nabídka bez položek nejde", () => {
  const j = job();
  j.work.push({ description: "", qty: 0, unit: "m²", unitPrice: 0 });
  assert.equal(buildQuote({ job: j, title: "x", supplier, customer: null, vatPayer: true }).lines.length, 2);
  assert.throws(() => buildQuote({ job: { ...job(), work: [], materials: [] }, title: "x", supplier, customer: null, vatPayer: true }), /žádnou položku/);
  const noName = job();
  noName.work[0]!.description = " ";
  assert.throws(() => buildQuote({ job: noName, title: "x", supplier, customer: null, vatPayer: true }), /popis/);
});

import { buildAdvance, buildDdpp, buildInvoice, variableSymbol } from "../src/index.ts";

const customer = { name: "Eva Dvořáková", city: "Brno" };
const payment = { bankAccount: "19-2000145399/0800", iban: "CZ6508000000192000145399", bic: null };

test("faktura sedí s nabídkou i souhrnem zakázky", () => {
  const inv = buildInvoice({ job: job(), title: "Střecha", supplier, customer, vatPayer: true, payment });
  assert.equal(inv.total, kc(65_184));
  assert.equal(inv.amountDue, kc(65_184));
  assert.deepEqual(inv.recap, [{ rate: 12, base: kc(58_200), vat: kc(6_984), total: kc(65_184) }]);
  assert.equal(inv.lines.length, 2, "jen práce a účtovaný materiál");
});

test("sleva částkou i v % dává na faktuře totéž co souhrn zakázky", () => {
  for (const discount of [{ kind: "amount" as const, amount: kc(2_200) }, { kind: "percent" as const, bp: 1000 }]) {
    const j = { ...job(), discount };
    const inv = buildInvoice({ job: j, title: "x", supplier, customer, vatPayer: true });
    assert.equal(inv.total, summarizeJob(j).gross);
  }
});

test("faktura bez odběratele nejde, přenesená povinnost chce DIČ odběratele", () => {
  assert.throws(() => buildInvoice({ job: job(), title: "x", supplier, customer: null, vatPayer: true }), /odběratele/);
  const rc = { ...job(), vatMode: "reverse_charge" as const };
  assert.throws(() => buildInvoice({ job: rc, title: "x", supplier, customer, vatPayer: true }), /DIČ/);
  const ok = buildInvoice({ job: rc, title: "x", supplier, customer: { ...customer, dic: "CZ12345678" }, vatPayer: true });
  assert.equal(ok.recap[0]!.vat, 0);
  assert.deepEqual(ok.notes, ["Daň odvede zákazník"]);
});

test("záloha 30 % → DDPP → odečet na faktuře: k úhradě zbývá zbytek", () => {
  const adv = buildAdvance({ job: job(), title: "Střecha", supplier, customer, vatPayer: true, spec: { percentBp: 3000 }, payment });
  assert.equal(adv.amountDue, kc(19_555.2));
  assert.deepEqual(adv.recap, [], "záloha není daňový doklad");
  assert.ok(adv.notes.includes("Nejedná se o daňový doklad"));

  const dd = buildDdpp(adv, "ZF-2026-001", adv.amountDue);
  assert.equal(dd.recap[0]!.base + dd.recap[0]!.vat, adv.amountDue);
  assert.equal(dd.recap[0]!.rate, 12);

  const inv = buildInvoice({
    job: job(), title: "Střecha", supplier, customer, vatPayer: true,
    deductions: [{ advanceNumber: "ZF-2026-001", ddppNumber: "DD-2026-001", status: "paid", paidGross: adv.amountDue, vatRate: 12, ddppBase: dd.recap[0]!.base, ddppVat: dd.recap[0]!.vat }],
  });
  assert.equal(inv.amountDue, kc(65_184) - adv.amountDue);
  assert.equal(inv.recapAfterDeductions[0]!.vat, kc(6_984) - dd.recap[0]!.vat);
});

test("neplátce: záloha bez DPH a DDPP se nevystavuje", () => {
  const adv = buildAdvance({ job: job(), title: "x", supplier, customer, vatPayer: false, spec: { amount: kc(10_000) } });
  assert.equal(adv.vatMode, "non_payer");
  assert.equal(adv.amountDue, kc(10_000));
  assert.throws(() => buildDdpp(adv, "ZF-1", kc(10_000)), /plátce/);
  assert.throws(() => buildAdvance({ job: job(), title: "x", supplier, customer, vatPayer: false, spec: { amount: kc(100_000) } }), /vyšší/);
});

test("variabilní symbol z čísla dokladu", () => {
  assert.equal(variableSymbol("FV-2026-001"), "2026001");
  assert.equal(variableSymbol("2026001"), "2026001");
  assert.equal(variableSymbol("ZF-2026-0123456789"), "0123456789");
});
