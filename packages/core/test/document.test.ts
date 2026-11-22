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
