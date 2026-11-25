import { variableSymbol, type InvoiceSnapshot, type Party } from "@iremeslo/core";

/**
 * ISDOC 6.0.2 – český formát elektronické faktury (čtou ho Pohoda, Money S3, ABRA, Helios, iDoklad…).
 * Z jedné vystavené faktury, zálohové faktury nebo daňového dokladu k platbě udělá XML.
 * Částky jsou v aplikaci v haléřích, množství v setinách – tady se převádějí na desetinná čísla.
 */

export interface IsdocInput {
  id: string;
  type: "invoice" | "invoice_non_payer" | "advance" | "ddpp";
  number: string;
  issueDate: string;
  taxableDate: string | null;
  dueDate: string | null;
  snapshot: InvoiceSnapshot;
}

/** Druh dokladu podle ISDOC: 1 faktura (daňový doklad), 4 zálohová faktura, 5 daňový doklad k přijaté platbě. */
const DOC_TYPE: Record<IsdocInput["type"], string> = { invoice: "1", invoice_non_payer: "1", advance: "4", ddpp: "5" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (h: number) => (h / 100).toFixed(2);
const qty = (q: number) => (q / 100).toFixed(2).replace(/\.?0+$/, "") || "0";
const el = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : `<${name}>${esc(String(value))}</${name}>`;

/** „Hybernská 1007/20“ → ulice „Hybernská“, číslo „1007/20“ */
function splitStreet(street: string | null | undefined): { name: string; number: string } {
  const s = (street ?? "").trim();
  const m = s.match(/^(.*\D)\s+(\d[\w/]*)$/);
  return m ? { name: m[1].trim(), number: m[2] } : { name: s, number: "" };
}

function party(p: Party): string {
  const st = splitStreet(p.street);
  const dic = p.dic?.trim();
  return "<Party>"
    + `<PartyIdentification><ID>${esc(p.ico ?? "")}</ID></PartyIdentification>`
    + `<PartyName>${el("Name", p.name)}</PartyName>`
    + "<PostalAddress>"
    + `<StreetName>${esc(st.name)}</StreetName><BuildingNumber>${esc(st.number)}</BuildingNumber>`
    + `<CityName>${esc(p.city ?? "")}</CityName><PostalZone>${esc((p.zip ?? "").replace(/\s/g, ""))}</PostalZone>`
    + "<Country><IdentificationCode>CZ</IdentificationCode><Name>Česká republika</Name></Country>"
    + "</PostalAddress>"
    + `<PartyTaxScheme><CompanyID>${esc(dic ?? "")}</CompanyID><TaxScheme>${dic ? "VAT" : ""}</TaxScheme></PartyTaxScheme>`
    + (p.registerEntry ? `<RegisterIdentification><Preformatted>${esc(p.registerEntry)}</Preformatted></RegisterIdentification>` : "")
    + (p.email || p.phone ? `<Contact>${el("Telephone", p.phone)}${el("ElectronicMail", p.email)}</Contact>` : "")
    + "</Party>";
}

export function buildIsdoc(d: IsdocInput): string {
  const s = d.snapshot;
  const vat = s.vatPayer && s.vatMode === "standard" && d.type !== "advance";
  const lines = s.lines.map((l, i) => {
    const rate = vat ? l.vatRate : 0;
    const lineVat = Math.round((l.total * rate) / 100);
    const unitVat = Math.round((l.unitPrice * rate) / 100);
    return "<InvoiceLine>"
      + `<ID>${i + 1}</ID>`
      + `<InvoicedQuantity unitCode="${esc(l.unit || "ks")}">${qty(l.qty)}</InvoicedQuantity>`
      + `<LineExtensionAmount>${money(l.total)}</LineExtensionAmount>`
      + `<LineExtensionAmountTaxInclusive>${money(l.total + lineVat)}</LineExtensionAmountTaxInclusive>`
      + `<LineExtensionTaxAmount>${money(lineVat)}</LineExtensionTaxAmount>`
      + `<UnitPrice>${money(l.unitPrice)}</UnitPrice>`
      + `<UnitPriceTaxInclusive>${money(l.unitPrice + unitVat)}</UnitPriceTaxInclusive>`
      + `<ClassifiedTaxCategory><Percent>${rate}</Percent><VATCalculationMethod>0</VATCalculationMethod><VATApplicable>${vat}</VATApplicable></ClassifiedTaxCategory>`
      + `<Item><Description>${esc(l.description)}</Description></Item>`
      + "</InvoiceLine>";
  }).join("");

  // Rekapitulace DPH; odečtené zálohy jako „již uplatněno“ ve stejné sazbě.
  const recap = s.recap.length ? s.recap : [{ rate: 0 as const, base: s.total, vat: 0, total: s.total }];
  const claimed = (rate: number) => s.deductions.filter((x) => x.rate === rate)
    .reduce((a, x) => ({ base: a.base + x.base, vat: a.vat + x.vat, gross: a.gross + x.gross }), { base: 0, vat: 0, gross: 0 });
  const sub = recap.map((r) => {
    const c = claimed(r.rate);
    return "<TaxSubTotal>"
      + `<TaxableAmount>${money(r.base)}</TaxableAmount><TaxAmount>${money(r.vat)}</TaxAmount><TaxInclusiveAmount>${money(r.total)}</TaxInclusiveAmount>`
      + `<AlreadyClaimedTaxableAmount>${money(c.base)}</AlreadyClaimedTaxableAmount><AlreadyClaimedTaxAmount>${money(c.vat)}</AlreadyClaimedTaxAmount>`
      + `<AlreadyClaimedTaxInclusiveAmount>${money(c.gross)}</AlreadyClaimedTaxInclusiveAmount>`
      + `<DifferenceTaxableAmount>${money(r.base - c.base)}</DifferenceTaxableAmount><DifferenceTaxAmount>${money(r.vat - c.vat)}</DifferenceTaxAmount>`
      + `<DifferenceTaxInclusiveAmount>${money(r.total - c.gross)}</DifferenceTaxInclusiveAmount>`
      + `<TaxCategory><Percent>${vat ? r.rate : 0}</Percent><VATApplicable>${vat}</VATApplicable></TaxCategory>`
      + "</TaxSubTotal>";
  }).join("");
  const sum = (k: "base" | "vat" | "total") => recap.reduce((a, r) => a + r[k], 0);
  const paid = s.deductions.reduce((a, x) => a + x.gross, 0);
  const claimedBase = s.deductions.reduce((a, x) => a + x.base, 0);

  const notes = [s.title, ...s.notes].filter(Boolean).join(" · ");
  const p = s.payment;
  const vs = variableSymbol(d.number);
  const [account, bank] = (p?.bankAccount ?? "").split("/");

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">'
    + `<DocumentType>${DOC_TYPE[d.type]}</DocumentType>`
    + "<TargetConsolidator></TargetConsolidator><ClientOnTargetConsolidator></ClientOnTargetConsolidator>"
    + `<ID>${esc(d.number)}</ID>`
    + `<UUID>${d.id.toUpperCase()}</UUID>`
    + "<IssuingSystem>iRemeslo.cz</IssuingSystem>"
    + `<IssueDate>${d.issueDate}</IssueDate>`
    + (vat && d.taxableDate ? `<TaxPointDate>${d.taxableDate}</TaxPointDate>` : "")
    + `<VATApplicable>${vat ? "true" : "false"}</VATApplicable>`
    + "<ElectronicPossibilityAgreementReference>Dokument není k dispozici</ElectronicPossibilityAgreementReference>"
    + (notes ? `<Note>${esc(notes)}</Note>` : "")
    + "<LocalCurrencyCode>CZK</LocalCurrencyCode><CurrRate>1</CurrRate><RefCurrRate>1</RefCurrRate>"
    + `<AccountingSupplierParty>${party(s.supplier)}</AccountingSupplierParty>`
    + `<AccountingCustomerParty>${party(s.customer)}</AccountingCustomerParty>`
    + `<InvoiceLines>${lines}</InvoiceLines>`
    + `<TaxTotal>${sub}<TaxAmount>${money(sum("vat"))}</TaxAmount></TaxTotal>`
    + "<LegalMonetaryTotal>"
    + `<TaxExclusiveAmount>${money(sum("base"))}</TaxExclusiveAmount><TaxInclusiveAmount>${money(sum("total"))}</TaxInclusiveAmount>`
    + `<AlreadyClaimedTaxExclusiveAmount>${money(claimedBase)}</AlreadyClaimedTaxExclusiveAmount>`
    + `<AlreadyClaimedTaxInclusiveAmount>${money(paid)}</AlreadyClaimedTaxInclusiveAmount>`
    + `<DifferenceTaxExclusiveAmount>${money(sum("base") - claimedBase)}</DifferenceTaxExclusiveAmount>`
    + `<DifferenceTaxInclusiveAmount>${money(sum("total") - paid)}</DifferenceTaxInclusiveAmount>`
    + `<PayableRoundingAmount>${money(s.rounding)}</PayableRoundingAmount>`
    + `<PaidDepositsAmount>${money(paid)}</PaidDepositsAmount>`
    + `<PayableAmount>${money(s.amountDue)}</PayableAmount>`
    + "</LegalMonetaryTotal>"
    + (d.type !== "ddpp" && p
      ? "<PaymentMeans><Payment>"
        + `<PaidAmount>${money(s.amountDue)}</PaidAmount><PaymentMeansCode>42</PaymentMeansCode>`
        + "<Details>"
        + el("PaymentDueDate", d.dueDate)
        + `<ID>${esc(account?.trim() ?? "")}</ID><BankCode>${esc(bank?.trim() ?? "")}</BankCode><Name></Name>`
        + `<IBAN>${esc(p.iban?.replace(/\s/g, "") ?? "")}</IBAN><BIC>${esc(p.bic ?? "")}</BIC>`
        + `<VariableSymbol>${esc(vs)}</VariableSymbol><ConstantSymbol></ConstantSymbol>`
        + "</Details></Payment></PaymentMeans>"
      : "")
    + "</Invoice>\n";
}
