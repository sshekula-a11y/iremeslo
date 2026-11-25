import { buildIsdoc } from "../../src/lib/documents/isdoc.ts";
import { writeFileSync } from "node:fs";
const sup = { name: "Malířství Novák", ico: "25020137", dic: null, street: "Hybernská 1007/20", city: "Praha", zip: "110 00" };
const cus = { name: "Jan Novák", street: "Lipová", city: "Brno", zip: "602 00" };
const base = { version: 1, title: "Výmalba", supplier: sup, customer: cus, siteAddress: null, lines: [{ description: "Práce", qty: 100, unit: "", unitPrice: 100000, total: 100000, vatRate: 21 }],
  subtotal: 100000, discount: 0, deductions: [], recapAfterDeductions: [], rounding: 0, notes: ["Nejsem plátce DPH."], payment: { bankAccount: "123/0800", iban: null, bic: null } };
const v: Record<string, any> = {
  neplatce: { type: "invoice_non_payer", s: { ...base, kind: "invoice", vatMode: "non_payer", vatPayer: false, recap: [], total: 100000, amountDue: 100000 } },
  zaloha: { type: "advance", s: { ...base, kind: "advance", vatMode: "standard", vatPayer: true, recap: [], total: 121000, amountDue: 121000, advanceVatRate: 21 } },
  ddpp: { type: "ddpp", s: { ...base, kind: "ddpp", vatMode: "standard", vatPayer: true, recap: [{ rate: 21, base: 100000, vat: 21000, total: 121000 }], total: 121000, amountDue: 121000 } },
  bezuctu: { type: "invoice", s: { ...base, kind: "invoice", vatMode: "standard", vatPayer: true, supplier: { ...sup, dic: "CZ25020137" }, recap: [{ rate: 21, base: 100000, vat: 21000, total: 121000 }], total: 121000, amountDue: 121000, payment: null } },
  prenesena: { type: "invoice", s: { ...base, kind: "invoice", vatMode: "reverse_charge", vatPayer: true, recap: [{ rate: 0, base: 100000, vat: 0, total: 100000 }], total: 100000, amountDue: 100000 } },
};
for (const [k, x] of Object.entries(v)) writeFileSync(`${process.argv[2]}/${k}.isdoc`, buildIsdoc({ id: "3f9a2b1c-0000-4000-8000-00000000000" + Object.keys(v).indexOf(k), type: x.type, number: "2026-" + k, issueDate: "2026-11-20", taxableDate: "2026-11-20", dueDate: "2026-12-04", snapshot: x.s }));
