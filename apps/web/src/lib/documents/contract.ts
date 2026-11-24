import { effectiveRate, formatCzk, vatFromBase, type Party, type VatMode, type VatRate } from "@iremeslo/core";
import { formatDate } from "@/lib/format";
import { THEMES, type ThemeKey } from "./themes";
import type { DocumentMeta, DocumentView } from "./view";

/**
 * Smlouva o dílo (§ 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník) a předávací protokol k ní.
 * Čisté funkce bez serveru: stejný kód počítá živý náhled ve formuláři, uložení na serveru i PDF.
 * Peníze v haléřích (celá čísla).
 */

export interface ContractInput {
  title: string;
  subject: string;
  priceNet: number;
  dateFrom: string | null;
  dateTo: string | null;
  siteAddress: string | null;
  advancePct: number;
  paymentTermsDays: number;
  warrantyMonths: number;
  notes: string;
}

export interface ContractSnapshot extends ContractInput {
  kind: "contract";
  supplier: Party;
  customer: Party;
  vatPayer: boolean;
  vatMode: VatMode;
  vatRate: VatRate;
  vat: number;
  gross: number;
}

export interface HandoverSnapshot {
  kind: "handover";
  contractNumber: string;
  title: string;
  subject: string;
  supplier: Party;
  customer: Party;
  siteAddress: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  warrantyMonths: number;
}

export class ContractError extends Error {}

/** Snapshot smlouvy z údajů formuláře; DPH se počítá tady, ne v prohlížeči. */
export function buildContract(p: {
  input: ContractInput; supplier: Party; customer: Party | null; vatPayer: boolean; vatMode: VatMode; vatRate: VatRate;
}): ContractSnapshot {
  const i = p.input;
  if (!p.customer || !p.customer.name.trim()) throw new ContractError("Smlouva musí mít objednatele – vyberte u zakázky zákazníka.");
  if (i.title.trim().length < 3) throw new ContractError("Vyplňte předmět smlouvy.");
  if (i.subject.trim().length < 10) throw new ContractError("Popište dílo podrobněji (alespoň 10 znaků).");
  if (!Number.isInteger(i.priceNet) || i.priceNet <= 0) throw new ContractError("Zadejte cenu díla.");
  if (i.dateFrom && i.dateTo && i.dateTo < i.dateFrom) throw new ContractError("Termín dokončení nesmí být před zahájením.");
  if (i.advancePct < 0 || i.advancePct > 100) throw new ContractError("Záloha musí být 0–100 %.");
  if (i.paymentTermsDays < 0 || i.paymentTermsDays > 365) throw new ContractError("Splatnost může být 0–365 dní.");
  if (i.warrantyMonths < 0 || i.warrantyMonths > 120) throw new ContractError("Záruka může být 0–120 měsíců.");

  const vatMode: VatMode = p.vatPayer ? p.vatMode : "non_payer";
  const rate = effectiveRate(vatMode, p.vatRate);
  const vat = vatMode === "standard" ? vatFromBase(i.priceNet, rate) : 0;
  return {
    kind: "contract",
    ...i,
    title: i.title.trim(),
    subject: i.subject.trim(),
    notes: i.notes.trim(),
    siteAddress: i.siteAddress?.trim() || null,
    supplier: p.supplier,
    customer: p.customer,
    vatPayer: p.vatPayer,
    vatMode,
    vatRate: rate,
    vat,
    gross: i.priceNet + vat,
  };
}

export function buildHandover(c: ContractSnapshot, contractNumber: string): HandoverSnapshot {
  return {
    kind: "handover",
    contractNumber,
    title: c.title,
    subject: c.subject,
    supplier: c.supplier,
    customer: c.customer,
    siteAddress: c.siteAddress,
    dateFrom: c.dateFrom,
    dateTo: c.dateTo,
    warrantyMonths: c.warrantyMonths,
  };
}

const kc = (n: number) => formatCzk(n);
const months = (n: number) => (n === 1 ? "1 měsíc" : n >= 2 && n <= 4 ? `${n} měsíce` : `${n} měsíců`);
const days = (n: number) => (n === 1 ? "1 den" : n >= 2 && n <= 4 ? `${n} dny` : `${n} dní`);

function partyLines(p: Party): string[] {
  const address = [p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [
    address,
    [p.ico ? `IČO ${p.ico}` : null, p.dic ? `DIČ ${p.dic}` : null].filter(Boolean).join(" · "),
    [p.phone, p.email].filter(Boolean).join(" · "),
    p.registerEntry ?? "",
  ].filter((l) => l.trim() !== "");
}

function base(m: DocumentMeta) {
  const theme = THEMES[(m.theme in THEMES ? m.theme : "oranzova") as ThemeKey];
  return { accent: theme.accent, accentText: theme.accentText };
}

function termText(from: string | null, to: string | null): string {
  if (from && to) return `Zhotovitel zahájí provádění díla dne ${formatDate(from)} a dokončí je nejpozději dne ${formatDate(to)}.`;
  if (to) return `Zhotovitel dokončí dílo nejpozději dne ${formatDate(to)}.`;
  if (from) return `Zhotovitel zahájí provádění díla dne ${formatDate(from)}; termín dokončení si strany sjednají písemně.`;
  return "Termín zahájení a dokončení díla si smluvní strany sjednají písemně.";
}

const EMPTY_TABLE: Pick<DocumentView, "columns" | "rows" | "totals" | "recap" | "payment"> = {
  columns: { description: "", qty: "", unit: "", unitPrice: "", total: "" },
  rows: [],
  totals: [],
  recap: null,
  payment: null,
};

export function contractView(s: ContractSnapshot, m: DocumentMeta): DocumentView {
  const priceLines: string[] = [];
  if (s.vatMode === "standard") {
    priceLines.push(`Cena díla je sjednána dohodou smluvních stran jako cena pevná ve výši ${kc(s.priceNet)} bez DPH. DPH ${s.vatRate} % činí ${kc(s.vat)}, cena díla včetně DPH činí ${kc(s.gross)}.`);
  } else if (s.vatMode === "reverse_charge") {
    priceLines.push(`Cena díla je sjednána dohodou smluvních stran jako cena pevná ve výši ${kc(s.priceNet)} bez DPH. Daň odvede objednatel v režimu přenesené daňové povinnosti podle § 92e zákona o DPH.`);
  } else {
    priceLines.push(`Cena díla je sjednána dohodou smluvních stran jako cena pevná ve výši ${kc(s.priceNet)}. Zhotovitel není plátcem DPH.`);
  }
  priceLines.push("Cena zahrnuje veškeré náklady zhotovitele nutné k řádnému provedení díla. Práce nad rámec předmětu smlouvy provede zhotovitel jen na základě písemné dohody o jejich rozsahu a ceně.");

  const total = s.vatMode === "standard" ? s.gross : s.priceNet;
  const advance = Math.round((total * s.advancePct) / 100);
  const pay: string[] = [];
  if (s.advancePct > 0) pay.push(`Objednatel uhradí před zahájením prací zálohu ve výši ${s.advancePct} % ceny díla, tj. ${kc(advance)}, na základě zálohové faktury zhotovitele.`);
  pay.push(`${s.advancePct > 0 ? "Zbývající část ceny" : "Cenu díla"} uhradí objednatel na základě faktury vystavené zhotovitelem po předání a převzetí díla, se splatností ${days(s.paymentTermsDays)} ode dne jejího vystavení.`);
  pay.push("Při prodlení s úhradou je zhotovitel oprávněn požadovat úrok z prodlení v zákonné výši.");

  const articles: NonNullable<DocumentView["articles"]> = [
    { title: "Předmět smlouvy", paragraphs: [
      "Zhotovitel se zavazuje provést pro objednatele na svůj náklad a nebezpečí dílo specifikované níže a objednatel se zavazuje dílo převzít a zaplatit za něj sjednanou cenu.",
      s.subject,
      ...(s.siteAddress ? [`Místo provedení díla: ${s.siteAddress}.`] : []),
    ] },
    { title: "Doba plnění", paragraphs: [termText(s.dateFrom, s.dateTo), "Objednatel umožní zhotoviteli přístup na místo provedení díla a zajistí podmínky nutné pro jeho provedení."] },
    { title: "Cena díla", paragraphs: priceLines },
    { title: "Platební podmínky", paragraphs: pay },
    { title: "Předání a převzetí díla", paragraphs: [
      "Dílo je dokončeno jeho předáním a převzetím. O předání a převzetí sepíší smluvní strany předávací protokol.",
      "Objednatel není povinen převzít dílo s vadami, které brání jeho užívání. Drobné vady, které užívání nebrání, uvedou strany v předávacím protokolu spolu se lhůtou k jejich odstranění.",
    ] },
    { title: "Záruka a vady díla", paragraphs: [
      s.warrantyMonths > 0
        ? `Zhotovitel poskytuje na dílo záruku za jakost v délce ${months(s.warrantyMonths)} ode dne převzetí díla objednatelem.`
        : "Práva objednatele z vadného plnění se řídí občanským zákoníkem.",
      "Vady díla oznámí objednatel zhotoviteli písemně bez zbytečného odkladu po jejich zjištění. Zhotovitel oprávněné vady bezplatně odstraní v přiměřené lhůtě dohodnuté se objednatelem.",
    ] },
    ...(s.notes ? [{ title: "Další ujednání", paragraphs: [s.notes] }] : []),
    { title: "Závěrečná ustanovení", paragraphs: [
      "Práva a povinnosti smluvních stran se řídí zákonem č. 89/2012 Sb., občanský zákoník, zejména ustanoveními § 2586 a násl. o smlouvě o dílo.",
      "Smlouvu lze měnit jen písemnými dodatky podepsanými oběma stranami. Smlouva je vyhotovena ve dvou stejnopisech, z nichž každá strana obdrží jeden, a nabývá účinnosti dnem podpisu oběma stranami.",
    ] },
  ];

  const meta: DocumentView["meta"] = [{ label: "Datum vystavení", value: formatDate(m.issueDate) }];
  if (s.dateFrom || s.dateTo) meta.push({ label: "Termín díla", value: [s.dateFrom, s.dateTo].filter(Boolean).map((d) => formatDate(d)).join(" – ") });
  meta.push({ label: s.vatMode === "standard" ? "Cena s DPH" : "Cena díla", value: kc(total) });
  if (s.siteAddress) meta.push({ label: "Místo plnění", value: s.siteAddress });

  return {
    heading: "Smlouva o dílo",
    number: m.number,
    title: s.title,
    ...base(m),
    logoUrl: m.logoUrl,
    stampUrl: m.stampUrl ?? null,
    signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.customer.name, lines: partyLines(s.customer) },
    partyLabels: ["Zhotovitel", "Objednatel"],
    meta,
    ...EMPTY_TABLE,
    articles,
    notes: [],
    signatures: { left: "Za zhotovitele", right: "Za objednatele", place: true },
    footer: "Smlouva o dílo podle § 2586 a násl. občanského zákoníku. Ceny jsou v Kč.",
  };
}

export function handoverView(s: HandoverSnapshot, m: DocumentMeta): DocumentView {
  const meta: DocumentView["meta"] = [
    { label: "Ke smlouvě o dílo", value: s.contractNumber },
    { label: "Vystaveno", value: formatDate(m.issueDate) },
  ];
  if (s.siteAddress) meta.push({ label: "Místo předání", value: s.siteAddress });
  if (s.dateTo) meta.push({ label: "Termín dle smlouvy", value: formatDate(s.dateTo) });

  return {
    heading: "Předávací protokol",
    number: m.number,
    title: s.title,
    ...base(m),
    logoUrl: m.logoUrl,
    stampUrl: m.stampUrl ?? null,
    signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.customer.name, lines: partyLines(s.customer) },
    partyLabels: ["Předávající (zhotovitel)", "Přebírající (objednatel)"],
    meta,
    ...EMPTY_TABLE,
    articles: [
      { title: "Předmět předání", paragraphs: [
        `Zhotovitel předává a objednatel přebírá dílo provedené podle smlouvy o dílo č. ${s.contractNumber}:`,
        s.subject,
      ] },
      { title: "Výsledek převzetí", paragraphs: [
        "[   ]  Dílo je převzato bez vad a nedodělků.",
        "[   ]  Dílo je převzato s vadami a nedodělky uvedenými níže, které nebrání jeho užívání.",
        "[   ]  Dílo není převzato pro vady uvedené níže.",
        ...(s.warrantyMonths > 0 ? [`Dnem převzetí díla začíná běžet záruční doba ${months(s.warrantyMonths)} podle smlouvy.`] : []),
      ] },
    ],
    blanks: [
      { label: "Datum a místo předání", lines: 1 },
      { label: "Soupis vad a nedodělků a lhůta k jejich odstranění", lines: 4 },
      { label: "Poznámky", lines: 2 },
    ],
    notes: [],
    signatures: { left: "Předal (zhotovitel)", right: "Převzal (objednatel)", place: false },
    footer: `Předávací protokol ke smlouvě o dílo č. ${s.contractNumber}.`,
  };
}
