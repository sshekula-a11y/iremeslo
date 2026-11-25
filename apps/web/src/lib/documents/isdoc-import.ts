import type { ParsedInvoice } from "./pdf-import";

/** ISDOC (XML) z jiného programu → údaje převzaté faktury. */
export function parseIsdoc(xml: string): ParsedInvoice | null {
  if (!/<Invoice\b[^>]*isdoc/i.test(xml)) return null;
  const dec = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
  const tag = (src: string, name: string) => { const m = src.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`)); return m ? dec(m[1]) : ""; };
  const customer = xml.match(/<AccountingCustomerParty>([\s\S]*?)<\/AccountingCustomerParty>/)?.[1] ?? "";
  const ico = tag(tag(customer, "PartyIdentification") ? customer.match(/<PartyIdentification>[\s\S]*?<\/PartyIdentification>/)?.[0] ?? "" : "", "ID").replace(/\D/g, "");
  const monetary = xml.match(/<LegalMonetaryTotal>([\s\S]*?)<\/LegalMonetaryTotal>/)?.[1] ?? "";
  const total = Number(tag(monetary, "PayableAmount") || tag(monetary, "TaxInclusiveAmount"));
  const docType = tag(xml, "DocumentType");
  return {
    kind: docType === "4" ? "advance" : "invoice",
    number: tag(xml, "ID"),
    issueDate: tag(xml, "IssueDate"),
    dueDate: tag(xml, "PaymentDueDate"),
    customerName: tag(customer.match(/<PartyName>[\s\S]*?<\/PartyName>/)?.[0] ?? "", "Name"),
    customerIco: ico ? ico.padStart(8, "0").slice(-8) : "",
    total: Number.isFinite(total) ? total.toFixed(2) : "",
    vatPayer: tag(xml, "VATApplicable") === "true",
    source: tag(xml, "IssuingSystem") || "ISDOC",
  };
}
