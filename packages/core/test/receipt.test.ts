import { test } from "node:test";
import assert from "node:assert/strict";
import { amountsIn, parseReceiptText, parseSpaydText } from "../src/index.ts";

const TODAY = "2026-11-26";

test("částky v různých zápisech", () => {
  assert.deepEqual(amountsIn("CELKEM K ÚHRADĚ: 1 873,50 Kč"), [1873.5]);
  assert.deepEqual(amountsIn("Celkem 1.873,50"), [1873.5]);
  assert.deepEqual(amountsIn("Barva 2 × 799,00 = 1 598,00"), [799, 1598]);
  assert.deepEqual(amountsIn("Celkem 250,-"), [250]);
  assert.deepEqual(amountsIn("DPH 21 % 325,15"), [325.15]);
});

test("účtenka z hobbymarketu (text z fotky)", () => {
  const text = `HORNBACH Baumarkt CS spol. s r.o.
IČO 27645312 DIČ CZ27645312
Praha 5 - Černý Most
Účtenka č. 4711/0815
20.11.2026 14:32
Fasádní barva 15 l 2 x 799,00 1 598,00
Váleček 25 cm 275,50
CELKEM K ÚHRADĚ 1 873,50 Kč
Sazba Základ DPH
21% 1 548,35 325,15
Platba kartou VISA ****1234`;
  const r = parseReceiptText(text, TODAY);
  assert.equal(r.supplierIco, "27645312");
  assert.equal(r.supplierName, "HORNBACH Baumarkt CS spol. s r.o.");
  assert.equal(r.issueDate, "2026-11-20");
  assert.equal(r.total, 1873.5);
  assert.equal(r.vatBase, 1548.35);
  assert.equal(r.vat, 325.15);
  assert.equal(r.docNumber, "4711/0815");
  assert.equal(r.paidMethod, "card");
  assert.equal(r.category, "material");
  assert.equal(r.kind, "receipt");
});

test("čerpací stanice, OCR bez diakritiky", () => {
  const text = `Benzina s.r.o.
DIC: CZ60193328
Natural 95 41,20 l 1 520,00
CELKEM KC 1520,00
Hotove 2000,00 Vraceno 480,00
Datum: 25.11.26`;
  const r = parseReceiptText(text, TODAY);
  assert.equal(r.supplierIco, "60193328");
  assert.equal(r.total, 1520);
  assert.equal(r.issueDate, "2026-11-25");
  assert.equal(r.category, "phm");
  assert.equal(r.paidMethod, "cash");
});

test("přijatá faktura: IČO dodavatele, ne vlastní firmy", () => {
  const text = `FAKTURA - DAŇOVÝ DOKLAD č. 2026-0153
Dodavatel: DEK a.s., IČO: 27636801, DIČ: CZ27636801
Odběratel: Malíř Novák, IČO: 12345679
Datum vystavení: 18. 11. 2026
Datum splatnosti: 2. 12. 2026
Rekapitulace DPH
21 % 10 000,00 2 100,00 12 100,00
Celkem k úhradě 12 100,00 Kč
Platba převodem na účet 123456789/0800`;
  const r = parseReceiptText(text, TODAY, "12345679");
  assert.equal(r.kind, "invoice");
  assert.equal(r.supplierIco, "27636801");
  assert.equal(r.supplierName, "DEK a.s.");
  assert.equal(r.issueDate, "2026-11-18");
  assert.equal(r.total, 12100);
  assert.equal(r.vatBase, 10000);
  assert.equal(r.vat, 2100);
  assert.equal(r.paidMethod, "bank");
});

test("název dodavatele u faktury ve dvou sloupcích", () => {
  const text = `FAKTURA - DAŇOVÝ DOKLAD č. 2026-0153
Dodavatel Odběratel
DEK a.s. TEST e2e Malířství
IČO: 27636801, DIČ: CZ27636801 IČO: 00000019
Celkem k úhradě 12 100,00 Kč`;
  assert.equal(parseReceiptText(text, TODAY, "00000019").supplierName, "DEK a.s.");
  assert.equal(parseReceiptText("Prodejna Lidl\nCelkem 99,90", TODAY).supplierName, "Prodejna Lidl");
});

test("nesmyslná data a neplatná IČO se ignorují", () => {
  const r = parseReceiptText("IČO 12345678\nDatum 31.02.2026\nCelkem 99,90", TODAY);
  assert.equal(r.supplierIco, null); // neplatný kontrolní součet
  assert.equal(r.issueDate, null);
  assert.equal(r.total, 99.9);
  assert.equal(parseReceiptText("Datum 1.1.2030\nCelkem 10,00", TODAY).issueDate, null); // z budoucnosti
});

test("QR Platba", () => {
  assert.deepEqual(parseSpaydText("SPD*1.0*ACC:CZ6508000000192000145399*AM:1873.50*CC:CZK*X-VS:20260153*DT:20261202*MSG:Faktura"), {
    amount: 1873.5, vs: "20260153", dueDate: "2026-12-02", iban: "CZ6508000000192000145399",
  });
  assert.equal(parseSpaydText("https://example.com"), null);
});
