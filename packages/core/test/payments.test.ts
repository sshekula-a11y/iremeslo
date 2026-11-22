import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kc,
  buildSpayd,
  czAccountToIban,
  isValidIban,
  formatIban,
  isValidIco,
  normalizeIco,
  isValidCzDic,
  formatDocumentNumber,
  variableSymbolFromNumber,
  DEFAULT_SERIES,
  allocate,
  mulDivRound,
} from "../src/index.ts";

test("převod českého čísla účtu na IBAN", () => {
  // příklad z dokumentace ČNB
  assert.equal(czAccountToIban("19-2000145399/0800"), "CZ6508000000192000145399");
  assert.equal(isValidIban("CZ65 0800 0000 1920 0014 5399"), true);
  assert.equal(formatIban("CZ6508000000192000145399"), "CZ65 0800 0000 1920 0014 5399");
  assert.throws(() => czAccountToIban("19-2000145398/0800"), /kontrolní číslici/);
  assert.equal(isValidIban("CZ6508000000192000145398"), false);
});

test("QR Platba (SPAYD)", () => {
  const s = buildSpayd({
    iban: "CZ6508000000192000145399",
    amount: kc(65_184),
    variableSymbol: variableSymbolFromNumber("FV-2026-001"),
    dueDate: "2026-12-06",
    message: "Faktura FV-2026-001 – čištění střechy*",
  });
  assert.equal(
    s,
    "SPD*1.0*ACC:CZ6508000000192000145399*AM:65184.00*CC:CZK*DT:20261206*MSG:Faktura FV-2026-001  cisteni strechy%2A*X-VS:2026001",
  );
  assert.throws(() => buildSpayd({ iban: "CZ00", amount: 100 }), /IBAN/);
  assert.throws(() => buildSpayd({ iban: "CZ6508000000192000145399", amount: 0 }), /kladná/);
});

test("IČO a DIČ", () => {
  assert.equal(isValidIco("25020137"), true); // ESTI INTERNATIONAL s.r.o. z návrhu faktury
  assert.equal(isValidIco("25020138"), false);
  assert.equal(isValidIco("abc"), false);
  assert.equal(normalizeIco("123"), "00000123");
  assert.equal(isValidCzDic("CZ25020137"), true);
  assert.equal(isValidCzDic("25020137"), false);
});

test("číselné řady", () => {
  assert.equal(formatDocumentNumber(DEFAULT_SERIES.invoice, 2026, 1), "FV-2026-001");
  assert.equal(formatDocumentNumber(DEFAULT_SERIES.invoice_non_payer, 2026, 1), "2026001");
  assert.equal(formatDocumentNumber("ZF{RR}{NNNN}", 2026, 42), "ZF260042");
  assert.throws(() => formatDocumentNumber("FV-{NNN}", 2026, 1), /rok/);
  assert.throws(() => formatDocumentNumber("FV-{RRRR}-{NN}", 2026, 100), /nevejde/);
  assert.equal(variableSymbolFromNumber("FV-2026-001"), "2026001");
});

test("zaokrouhlení a rozdělení částek", () => {
  assert.equal(mulDivRound(5, 1, 2), 3);
  assert.equal(mulDivRound(-5, 1, 2), -3);
  assert.equal(mulDivRound(9_007_199_254_740, 1_000, 1_000), 9_007_199_254_740);
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(-100, [1, 1, 1]), [-34, -33, -33]);
  assert.equal(allocate(12_345, [3, 7, 11]).reduce((a, b) => a + b, 0), 12_345);
});
