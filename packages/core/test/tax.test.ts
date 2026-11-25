import { test } from "node:test";
import assert from "node:assert/strict";
import { annualize, compareRegimes, flatTaxBand, incomeTax, insurance, taxParams } from "../src/index.ts";

const p26 = taxParams(2026)!;

test("daň z příjmů: základ na stovky dolů, 15 %, sleva na poplatníka", () => {
  assert.deepEqual(incomeTax(400_049, p26), { base: 400_000, tax: 60_000 - 30_840 });
  assert.deepEqual(incomeTax(150_000, p26), { base: 150_000, tax: 0 }); // sleva převýší daň
  // nad 36násobkem průměrné mzdy 23 %
  const t = incomeTax(2_000_000, p26).tax;
  assert.equal(t, Math.ceil(1_762_812 * 0.15 + (2_000_000 - 1_762_812) * 0.23) - 30_840);
});

test("pojistné: 50 % zisku, nejméně minimum (2026: 35 % průměrné mzdy po zpětném snížení)", () => {
  const low = insurance(100_000, p26);
  assert.equal(low.social, Math.ceil(12 * 17_139 * 0.292)); // 60 056 = 12 × 5 005 (zaokrouhleno)
  assert.equal(low.health, Math.ceil(12 * 24_483.5 * 0.135));
  const high = insurance(1_000_000, p26);
  assert.equal(high.social, Math.ceil(500_000 * 0.292));
  assert.equal(high.health, Math.ceil(500_000 * 0.135));
});

test("minimální zálohy odpovídají zveřejněným částkám", () => {
  assert.equal(Math.ceil(17_139 * 0.292), p26.socialMinMonthly); // 5 005 Kč
  assert.equal(Math.ceil(24_483.5 * 0.135), p26.healthMinMonthly); // 3 306 Kč
  assert.equal(Math.ceil(Math.ceil(51_663 * 0.35) * 0.292), taxParams(2027)!.socialMinMonthly); // 5 281 Kč
});

test("pásma paušální daně podle výdajového paušálu", () => {
  assert.equal(flatTaxBand(900_000, 40, false), 1);
  assert.equal(flatTaxBand(1_900_000, 80, false), 1);
  assert.equal(flatTaxBand(1_400_000, 60, false), 1);
  assert.equal(flatTaxBand(1_900_000, 60, false), 2);
  assert.equal(flatTaxBand(1_400_000, 40, false), 2);
  assert.equal(flatTaxBand(1_900_000, 40, false), 3);
  assert.equal(flatTaxBand(2_100_000, 80, false), null);
  assert.equal(flatTaxBand(500_000, 80, true), null); // plátce DPH paušální daň mít nemůže
});

test("porovnání režimů pro řemeslníka s příjmy 1 mil. Kč", () => {
  const r = compareRegimes({ year: 2026, income: 1_000_000, actualExpenses: 300_000, flatRate: 80, vatPayer: false })!;
  const [actual, flat, flatTax] = r;
  assert.equal(actual.profit, 700_000);
  assert.equal(flat.expenses, 800_000);
  assert.equal(flat.profit, 200_000);
  assert.equal(flatTax.regime, "flat_tax");
  assert.equal(flatTax.band, 1);
  assert.equal(flatTax.total, 6 * 9_984 + 6 * 9_162);
  assert.ok(flat.total < actual.total);
  // limit výdajového paušálu 80 %: 1,6 mil. Kč
  const big = compareRegimes({ year: 2026, income: 2_500_000, actualExpenses: 0, flatRate: 80, vatPayer: true })!;
  assert.equal(big[1].expenses, 1_600_000);
  assert.equal(big.length, 2);
  assert.equal(compareRegimes({ year: 2019, income: 1, actualExpenses: 0, flatRate: 80, vatPayer: false }), null);
});

test("odhad na celý rok", () => {
  assert.equal(annualize(500_000, 2026, "2026-06-30"), Math.round(500_000 / (181 / 365)));
  assert.equal(annualize(500_000, 2025, "2026-03-01"), 500_000);
});
