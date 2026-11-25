import { effectiveRate, formatCzk, vatFromBase, type Party, type PaymentInfo, type VatMode, type VatRate } from "@iremeslo/core";
import { formatDate } from "@/lib/format";
import { toInput } from "@/lib/money";
import { base, days, EMPTY_TABLE, kc, months, partyLines } from "./contract";
import type { DocumentMeta, DocumentView } from "./view";

/**
 * Další listiny k podnikání: dodací list / soupis prací, příjmový a výdajový pokladní doklad,
 * upomínka a předžalobní výzva, reklamační protokol, dodatek ke smlouvě o dílo.
 * Čisté funkce (bez serveru): stejný kód dělá živý náhled, uložení i PDF. Peníze v haléřích.
 */

export class ListinaError extends Error {}

// ---------------------------------------------------------------------------
// Dodací list / soupis provedených prací
// ---------------------------------------------------------------------------

export interface DeliveryLine { description: string; qty: number; unit: string; unitPrice: number; total: number }
export interface DeliverySnapshot {
  kind: "delivery";
  title: string;
  supplier: Party;
  customer: Party;
  siteAddress: string | null;
  jobNumber: string | null;
  lines: DeliveryLine[];
  showPrices: boolean;
  vatPayer: boolean;
  note: string;
}

export function buildDelivery(p: Omit<DeliverySnapshot, "kind">): DeliverySnapshot {
  if (!p.customer?.name?.trim()) throw new ListinaError("Vyberte u zakázky zákazníka.");
  const lines = p.lines.filter((l) => l.description.trim());
  if (!lines.length) throw new ListinaError("Soupis musí mít aspoň jednu položku.");
  return { kind: "delivery", ...p, title: p.title.trim() || "Soupis provedených prací", lines, note: p.note.trim() };
}

export function deliveryView(s: DeliverySnapshot, m: DocumentMeta): DocumentView {
  const sum = s.lines.reduce((a, l) => a + l.total, 0);
  const meta: DocumentView["meta"] = [{ label: "Datum vystavení", value: formatDate(m.issueDate) }];
  if (s.jobNumber) meta.push({ label: "Zakázka", value: s.jobNumber });
  if (s.siteAddress) meta.push({ label: "Místo plnění", value: s.siteAddress });
  return {
    heading: "Dodací list – soupis prací",
    number: m.number,
    title: s.title,
    ...base(m),
    logoUrl: m.logoUrl, stampUrl: m.stampUrl ?? null, signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.customer.name, lines: partyLines(s.customer) },
    partyLabels: ["Dodavatel", "Odběratel"],
    meta,
    columns: { description: "Provedená práce / dodaný materiál", qty: "Množství", unit: "Jedn.", unitPrice: s.showPrices ? "Cena/jedn." : "", total: s.showPrices ? "Celkem" : "" },
    rows: s.lines.map((l) => ({
      description: l.description, qty: toInput(l.qty) || "0", unit: l.unit,
      unitPrice: s.showPrices ? formatCzk(l.unitPrice, { withCurrency: false }) : "", total: s.showPrices ? formatCzk(l.total, { withCurrency: false }) : "",
    })),
    totals: s.showPrices ? [{ label: s.vatPayer ? "Celkem bez DPH" : "Celkem", value: kc(sum), strong: true }] : [],
    recap: null,
    payment: null,
    notes: [
      "Odběratel svým podpisem potvrzuje, že uvedené práce byly provedeny a materiál dodán v uvedeném rozsahu.",
      ...(s.note ? [s.note] : []),
    ],
    blanks: [{ label: "Výhrady odběratele", lines: 2 }],
    signatures: { left: "Předal (dodavatel)", right: "Převzal (odběratel)", place: true },
    footer: s.showPrices ? "Dodací list není daňový doklad. Ceny jsou v Kč." : "Dodací list není daňový doklad.",
  };
}

// ---------------------------------------------------------------------------
// Pokladní doklady
// ---------------------------------------------------------------------------

export interface CashSnapshot {
  kind: "cash_in" | "cash_out";
  supplier: Party;
  counterparty: Party;
  amount: number;
  purpose: string;
  relatedNumber: string | null;
  vatPayer: boolean;
  vatRate: VatRate | null;
  base: number;
  vat: number;
}

export function buildCash(p: { kind: CashSnapshot["kind"]; supplier: Party; counterparty: Party; amount: number; purpose: string; relatedNumber: string | null; vatPayer: boolean; vatRate: VatRate | null }): CashSnapshot {
  if (!p.counterparty.name.trim()) throw new ListinaError(p.kind === "cash_in" ? "Vyplňte, od koho peníze přijímáte." : "Vyplňte, komu peníze vyplácíte.");
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw new ListinaError("Zadejte částku.");
  if (p.purpose.trim().length < 3) throw new ListinaError("Vyplňte účel platby.");
  const rate = p.vatPayer && p.vatRate ? p.vatRate : null;
  // částka je včetně DPH; základ a daň „shora“ (§ 37 zákona o DPH)
  const vat = rate ? Math.round((p.amount * rate) / (100 + rate)) : 0;
  return { ...p, purpose: p.purpose.trim(), vatRate: rate, base: p.amount - vat, vat };
}

const ONES = ["", "jedna", "dva", "tři", "čtyři", "pět", "šest", "sedm", "osm", "devět", "deset", "jedenáct", "dvanáct", "třináct", "čtrnáct", "patnáct", "šestnáct", "sedmnáct", "osmnáct", "devatenáct"];
const TENS = ["", "", "dvacet", "třicet", "čtyřicet", "padesát", "šedesát", "sedmdesát", "osmdesát", "devadesát"];
const HUNDREDS = ["", "sto", "dvěstě", "třista", "čtyřista", "pětset", "šestset", "sedmset", "osmset", "devětset"];
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  return HUNDREDS[h] + (r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + ONES[r % 10]);
}
/** 1234,50 Kč → „jedentisícdvěstětřicetčtyři Kč 50/100“ (jak se píše na pokladní doklad). */
export function amountInWords(halere: number): string {
  const kcs = Math.floor(Math.abs(halere) / 100), h = Math.abs(halere) % 100;
  if (kcs === 0) return `nula Kč ${String(h).padStart(2, "0")}/100`;
  const mil = Math.floor(kcs / 1_000_000), th = Math.floor((kcs % 1_000_000) / 1000), rest = kcs % 1000;
  let w = "";
  if (mil) w += (mil === 1 ? "jeden" : below1000(mil).replace(/jedna$/, "jeden")) + (mil === 1 ? "milion" : mil < 5 ? "miliony" : "milionů");
  if (th) w += (th === 1 ? "jeden" : below1000(th).replace(/jedna$/, "jeden")) + (th === 1 ? "tisíc" : th < 5 ? "tisíce" : "tisíc");
  if (rest) w += below1000(rest);
  return `${w} Kč${h ? ` ${String(h).padStart(2, "0")}/100` : ""}`;
}

export function cashView(s: CashSnapshot, m: DocumentMeta): DocumentView {
  const income = s.kind === "cash_in";
  const totals: DocumentView["totals"] = [];
  if (s.vatRate) totals.push({ label: `Základ DPH ${s.vatRate} %`, value: kc(s.base) }, { label: `DPH ${s.vatRate} %`, value: kc(s.vat) });
  totals.push({ label: income ? "Přijato celkem" : "Vyplaceno celkem", value: kc(s.amount), strong: true });
  return {
    heading: income ? "Příjmový pokladní doklad" : "Výdajový pokladní doklad",
    number: m.number,
    title: s.purpose,
    ...base(m),
    logoUrl: m.logoUrl, stampUrl: m.stampUrl ?? null, signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.counterparty.name, lines: partyLines(s.counterparty) },
    partyLabels: income ? ["Příjemce (pokladna)", "Přijato od"] : ["Plátce (pokladna)", "Vyplaceno komu"],
    meta: [
      { label: "Datum", value: formatDate(m.issueDate) },
      ...(s.relatedNumber ? [{ label: "K dokladu", value: s.relatedNumber }] : []),
    ],
    ...EMPTY_TABLE,
    totals,
    articles: [{ title: "Účel platby", paragraphs: [s.purpose, `Částka slovy: ${amountInWords(s.amount)}`] }],
    notes: [],
    signatures: income ? { left: "Přijal (pokladník)", right: "Zaplatil", place: false } : { left: "Vyplatil (pokladník)", right: "Přijal", place: false },
    footer: s.vatRate ? "Ceny jsou v Kč včetně DPH." : "Částky jsou v Kč.",
  };
}

// ---------------------------------------------------------------------------
// Upomínka a předžalobní výzva
// ---------------------------------------------------------------------------

export interface ReminderSnapshot {
  kind: "reminder";
  level: "reminder" | "final";
  supplier: Party;
  customer: Party;
  invoiceNumber: string;
  invoiceIssueDate: string | null;
  invoiceDueDate: string | null;
  invoiceTotal: number;
  paid: number;
  amountDue: number;
  newDueDate: string;
  payment: PaymentInfo | null;
  variableSymbol: string;
  b2b: boolean;
  note: string;
}

export function buildReminder(p: Omit<ReminderSnapshot, "kind">, today: string): ReminderSnapshot {
  if (p.amountDue <= 0) throw new ListinaError("Faktura je zaplacená – upomínka není potřeba.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.newDueDate) || p.newDueDate < today) throw new ListinaError("Zadejte novou lhůtu k úhradě v budoucnosti.");
  if (p.level === "final") {
    const min = new Date(`${today}T12:00:00Z`); min.setUTCDate(min.getUTCDate() + 7);
    if (p.newDueDate < min.toISOString().slice(0, 10)) throw new ListinaError("Předžalobní výzva musí dát aspoň 7 dní na zaplacení (§ 142a občanského soudního řádu).");
  }
  return { kind: "reminder", ...p, note: p.note.trim() };
}

export function reminderView(s: ReminderSnapshot, m: DocumentMeta): DocumentView {
  const final = s.level === "final";
  const late = s.invoiceDueDate && m.issueDate ? Math.max(0, Math.round((Date.parse(m.issueDate) - Date.parse(s.invoiceDueDate)) / 86_400_000)) : null;
  const pay = s.payment;
  const paras: string[] = [
    `dovolujeme si Vás upozornit, že dosud evidujeme neuhrazenou fakturu č. ${s.invoiceNumber}${s.invoiceIssueDate ? ` ze dne ${formatDate(s.invoiceIssueDate)}` : ""}${s.invoiceDueDate ? ` se splatností ${formatDate(s.invoiceDueDate)}` : ""}${late ? `, která je ${days(late)} po splatnosti` : ""}.`,
    `Dlužná částka činí ${kc(s.amountDue)}${s.paid > 0 ? ` (fakturováno ${kc(s.invoiceTotal)}, uhrazeno ${kc(s.paid)})` : ""}.`,
    `Prosíme o úhradu nejpozději do ${formatDate(s.newDueDate)}${pay?.bankAccount ? ` na účet ${pay.bankAccount}` : ""} s variabilním symbolem ${s.variableSymbol}. Pokud jste již zaplatili, považujte prosím tuto ${final ? "výzvu" : "upomínku"} za bezpředmětnou.`,
  ];
  const legal: string[] = [
    "Za dobu prodlení jsme oprávněni požadovat zákonný úrok z prodlení podle nařízení vlády č. 351/2013 Sb. (repo sazba ČNB platná k prvnímu dni kalendářního pololetí, v němž prodlení nastalo, zvýšená o 8 procentních bodů).",
    ...(s.b2b ? ["Jako podnikatel máme dále nárok na náhradu nákladů spojených s uplatněním pohledávky nejméně ve výši 1 200 Kč (§ 2 a 3 nařízení vlády č. 351/2013 Sb.)."] : []),
  ];
  if (final) {
    legal.push(
      "Tato výzva je výzvou k plnění podle § 142a zákona č. 99/1963 Sb., občanský soudní řád. Nebude-li dlužná částka uhrazena ve stanovené lhůtě, podáme bez dalšího upozornění návrh na zahájení soudního řízení. V takovém případě budeme požadovat i náhradu nákladů řízení, které mohou dlužnou částku výrazně navýšit.",
    );
  }
  return {
    heading: final ? "Předžalobní výzva k úhradě" : "Upomínka",
    number: m.number,
    title: `Faktura ${s.invoiceNumber} – ${kc(s.amountDue)}`,
    ...base(m),
    logoUrl: m.logoUrl, stampUrl: m.stampUrl ?? null, signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.customer.name, lines: partyLines(s.customer) },
    partyLabels: ["Věřitel", "Dlužník"],
    meta: [
      { label: "Datum", value: formatDate(m.issueDate) },
      { label: "Faktura", value: s.invoiceNumber },
      { label: "Dlužná částka", value: kc(s.amountDue) },
      { label: "Uhraďte do", value: formatDate(s.newDueDate) },
    ],
    ...EMPTY_TABLE,
    articles: [
      { title: "Vážená paní, vážený pane,", paragraphs: paras },
      { title: final ? "Upozornění" : "Úrok z prodlení", paragraphs: legal },
      ...(s.note ? [{ title: "Poznámka", paragraphs: [s.note] }] : []),
    ],
    notes: [],
    signatures: { left: "Za věřitele", right: "", place: false },
    footer: final ? "Předžalobní výzva podle § 142a o. s. ř. Doporučujeme odeslat doporučeně nebo do datové schránky." : "Upomínka k neuhrazené faktuře.",
  };
}

// ---------------------------------------------------------------------------
// Reklamační protokol
// ---------------------------------------------------------------------------

export interface ClaimSnapshot {
  kind: "claim";
  supplier: Party;
  customer: Party;
  relatedLabel: string | null;
  subject: string;
  defect: string;
  claimedOn: string;
  requestedRemedy: string;
  consumer: boolean;
  deadline: string | null;
}

export const REMEDIES = ["Oprava (odstranění vady)", "Přiměřená sleva z ceny", "Nové provedení díla / výměna", "Odstoupení od smlouvy"] as const;

export function buildClaim(p: Omit<ClaimSnapshot, "kind" | "deadline">): ClaimSnapshot {
  if (!p.customer?.name?.trim()) throw new ListinaError("Vyberte zákazníka.");
  if (p.subject.trim().length < 3) throw new ListinaError("Vyplňte, čeho se reklamace týká.");
  if (p.defect.trim().length < 10) throw new ListinaError("Popište vadu podrobněji (alespoň 10 znaků).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.claimedOn)) throw new ListinaError("Zadejte datum uplatnění reklamace.");
  // spotřebitel: vyřízení do 30 dnů (§ 2173 a § 19 zákona o ochraně spotřebitele)
  let deadline: string | null = null;
  if (p.consumer) { const d = new Date(`${p.claimedOn}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 30); deadline = d.toISOString().slice(0, 10); }
  return { kind: "claim", ...p, subject: p.subject.trim(), defect: p.defect.trim(), deadline };
}

export function claimView(s: ClaimSnapshot, m: DocumentMeta): DocumentView {
  return {
    heading: "Reklamační protokol",
    number: m.number,
    title: s.subject,
    ...base(m),
    logoUrl: m.logoUrl, stampUrl: m.stampUrl ?? null, signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.customer.name, lines: partyLines(s.customer) },
    partyLabels: ["Zhotovitel / prodávající", "Reklamující"],
    meta: [
      { label: "Reklamace uplatněna", value: formatDate(s.claimedOn) },
      ...(s.relatedLabel ? [{ label: "Týká se", value: s.relatedLabel }] : []),
      ...(s.deadline ? [{ label: "Vyřídit nejpozději", value: formatDate(s.deadline) }] : []),
    ],
    ...EMPTY_TABLE,
    articles: [
      { title: "Předmět reklamace", paragraphs: [s.subject] },
      { title: "Popis vady", paragraphs: [s.defect] },
      { title: "Požadovaný způsob vyřízení", paragraphs: [s.requestedRemedy] },
      { title: "Lhůta a postup", paragraphs: [
        s.consumer
          ? `Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů ode dne jejího uplatnění, tj. do ${formatDate(s.deadline)}, nedohodneme-li se na delší lhůtě. Práva z vadného plnění se řídí § 2615 a násl. a § 2165 a násl. občanského zákoníku.`
          : "Reklamaci vyřídíme bez zbytečného odkladu v přiměřené lhůtě dohodnuté s reklamujícím. Práva z vadného plnění se řídí § 2615 a násl. občanského zákoníku a smlouvou.",
        "Reklamující obdrží kopii tohoto protokolu. O vyřízení reklamace vydáme písemné potvrzení.",
      ] },
    ],
    blanks: [
      { label: "Stanovisko zhotovitele / způsob vyřízení", lines: 3 },
      { label: "Datum vyřízení", lines: 1 },
    ],
    notes: [],
    signatures: { left: "Za zhotovitele", right: "Reklamující", place: true },
    footer: "Reklamační protokol. Uschovejte si ho.",
  };
}

// ---------------------------------------------------------------------------
// Dodatek ke smlouvě o dílo
// ---------------------------------------------------------------------------

export interface AmendmentSnapshot {
  kind: "amendment";
  supplier: Party;
  customer: Party;
  contractNumber: string;
  contractTitle: string;
  amendmentNo: number;
  scope: string;
  priceNet: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  reason: string;
  vatMode: VatMode;
  vatRate: VatRate;
  vat: number;
  gross: number;
}

export function buildAmendment(p: {
  supplier: Party; customer: Party; contractNumber: string; contractTitle: string; amendmentNo: number;
  scope: string; priceNet: number | null; dateFrom: string | null; dateTo: string | null; reason: string; vatMode: VatMode; vatRate: VatRate;
}): AmendmentSnapshot {
  const scope = p.scope.trim();
  if (!scope && p.priceNet === null && !p.dateFrom && !p.dateTo) throw new ListinaError("Dodatek musí něco měnit – rozsah, cenu nebo termín.");
  if (p.priceNet !== null && (!Number.isInteger(p.priceNet) || p.priceNet <= 0)) throw new ListinaError("Nová cena musí být kladná.");
  if (p.dateFrom && p.dateTo && p.dateTo < p.dateFrom) throw new ListinaError("Dokončení nesmí být před zahájením.");
  const rate = effectiveRate(p.vatMode, p.vatRate);
  const vat = p.priceNet !== null && p.vatMode === "standard" ? vatFromBase(p.priceNet, rate) : 0;
  return { kind: "amendment", ...p, scope, reason: p.reason.trim(), vatRate: rate, vat, gross: (p.priceNet ?? 0) + vat };
}

export function amendmentView(s: AmendmentSnapshot, m: DocumentMeta): DocumentView {
  const changes: string[] = [];
  if (s.scope) changes.push(`Předmět díla se mění takto: ${s.scope}`);
  if (s.priceNet !== null) {
    changes.push(s.vatMode === "standard"
      ? `Cena díla se nově sjednává ve výši ${kc(s.priceNet)} bez DPH, DPH ${s.vatRate} % činí ${kc(s.vat)}, cena včetně DPH činí ${kc(s.gross)}.`
      : `Cena díla se nově sjednává ve výši ${kc(s.priceNet)}${s.vatMode === "reverse_charge" ? " bez DPH (přenesená daňová povinnost)" : ""}.`);
  }
  if (s.dateFrom || s.dateTo) {
    changes.push(s.dateFrom && s.dateTo ? `Termín plnění se mění: zahájení ${formatDate(s.dateFrom)}, dokončení nejpozději ${formatDate(s.dateTo)}.`
      : s.dateTo ? `Termín dokončení díla se mění na ${formatDate(s.dateTo)}.` : `Termín zahájení díla se mění na ${formatDate(s.dateFrom)}.`);
  }
  return {
    heading: `Dodatek č. ${s.amendmentNo}`,
    number: m.number,
    title: `ke smlouvě o dílo č. ${s.contractNumber} – ${s.contractTitle}`,
    ...base(m),
    logoUrl: m.logoUrl, stampUrl: m.stampUrl ?? null, signatureUrl: m.signatureUrl ?? null,
    supplier: { name: s.supplier.name, lines: partyLines(s.supplier) },
    customer: { name: s.customer.name, lines: partyLines(s.customer) },
    partyLabels: ["Zhotovitel", "Objednatel"],
    meta: [
      { label: "Datum", value: formatDate(m.issueDate) },
      { label: "Ke smlouvě", value: s.contractNumber },
    ],
    ...EMPTY_TABLE,
    articles: [
      { title: "Úvodní ustanovení", paragraphs: [
        `Smluvní strany uzavřely smlouvu o dílo č. ${s.contractNumber} („smlouva“). Tímto dodatkem se smlouva mění v rozsahu uvedeném níže${s.reason ? `, a to z důvodu: ${s.reason}` : ""}.`,
      ] },
      { title: "Změny smlouvy", paragraphs: changes },
      { title: "Závěrečná ustanovení", paragraphs: [
        "Ostatní ustanovení smlouvy zůstávají beze změny.",
        "Dodatek je vyhotoven ve dvou stejnopisech, každá strana obdrží jeden, a nabývá účinnosti dnem podpisu oběma stranami.",
      ] },
    ],
    notes: [],
    signatures: { left: "Za zhotovitele", right: "Za objednatele", place: true },
    footer: `Dodatek č. ${s.amendmentNo} ke smlouvě o dílo č. ${s.contractNumber}.`,
  };
}


// ---------------------------------------------------------------------------
// Společné: podklady ze systému (ListinaContext) + údaje z formuláře (ListinaInput) → snapshot
// ---------------------------------------------------------------------------

export type ListinaType = "delivery" | "cash_in" | "cash_out" | "reminder" | "claim" | "amendment";

/** Co o listině ví systém (načte server, formulář dostane stejnou kopii pro náhled). */
export interface ListinaContext {
  type: ListinaType;
  supplier: Party;
  customer: Party | null;
  clientId: string | null;
  jobId: string | null;
  relatedId: string | null;
  vatPayer: boolean;
  vatMode: VatMode;
  vatRate: VatRate;
  payment: PaymentInfo | null;
  job?: { number: string; title: string; siteAddress: string | null; lines: DeliveryLine[] };
  invoice?: { number: string; issueDate: string | null; dueDate: string | null; total: number; paid: number; amountDue: number };
  contract?: { number: string; title: string; nextNo: number };
  related?: { label: string };
}

export type ListinaInput =
  | { type: "delivery"; title: string; showPrices: boolean; note: string }
  | { type: "cash_in" | "cash_out"; counterparty: Party; amount: number; purpose: string; vatRate: VatRate | null; relatedNumber: string | null }
  | { type: "reminder"; level: "reminder" | "final"; newDueDate: string; note: string }
  | { type: "claim"; subject: string; defect: string; claimedOn: string; requestedRemedy: string; consumer: boolean }
  | { type: "amendment"; scope: string; priceNet: number | null; dateFrom: string | null; dateTo: string | null; reason: string };

export type ListinaSnapshot = DeliverySnapshot | CashSnapshot | ReminderSnapshot | ClaimSnapshot | AmendmentSnapshot;

export function buildListina(ctx: ListinaContext, input: ListinaInput, today: string): ListinaSnapshot {
  if (input.type !== ctx.type && !(ctx.type.startsWith("cash") && input.type.startsWith("cash"))) throw new ListinaError("Neplatná listina.");
  switch (input.type) {
    case "delivery": {
      if (!ctx.job || !ctx.customer) throw new ListinaError("Dodací list se vystavuje ze zakázky se zákazníkem.");
      return buildDelivery({ title: input.title, supplier: ctx.supplier, customer: ctx.customer, siteAddress: ctx.job.siteAddress, jobNumber: ctx.job.number,
        lines: ctx.job.lines, showPrices: input.showPrices, vatPayer: ctx.vatPayer, note: input.note });
    }
    case "cash_in":
    case "cash_out":
      return buildCash({ kind: input.type, supplier: ctx.supplier, counterparty: input.counterparty, amount: input.amount, purpose: input.purpose,
        relatedNumber: input.relatedNumber, vatPayer: ctx.vatPayer, vatRate: input.vatRate });
    case "reminder": {
      if (!ctx.invoice || !ctx.customer) throw new ListinaError("Upomínka se vystavuje k faktuře.");
      const i = ctx.invoice;
      return buildReminder({ level: input.level, supplier: ctx.supplier, customer: ctx.customer, invoiceNumber: i.number, invoiceIssueDate: i.issueDate,
        invoiceDueDate: i.dueDate, invoiceTotal: i.total, paid: i.paid, amountDue: i.amountDue, newDueDate: input.newDueDate, payment: ctx.payment,
        variableSymbol: i.number.replace(/\D/g, "").slice(-10), b2b: !!ctx.customer.ico, note: input.note }, today);
    }
    case "claim":
      if (!ctx.customer) throw new ListinaError("Reklamace musí mít zákazníka.");
      return buildClaim({ supplier: ctx.supplier, customer: ctx.customer, relatedLabel: ctx.related?.label ?? null, subject: input.subject, defect: input.defect,
        claimedOn: input.claimedOn, requestedRemedy: input.requestedRemedy, consumer: input.consumer });
    case "amendment":
      if (!ctx.contract || !ctx.customer) throw new ListinaError("Dodatek se vystavuje ke smlouvě o dílo.");
      return buildAmendment({ supplier: ctx.supplier, customer: ctx.customer, contractNumber: ctx.contract.number, contractTitle: ctx.contract.title,
        amendmentNo: ctx.contract.nextNo, scope: input.scope, priceNet: input.priceNet, dateFrom: input.dateFrom, dateTo: input.dateTo, reason: input.reason,
        vatMode: ctx.vatPayer ? ctx.vatMode : "non_payer", vatRate: ctx.vatRate });
  }
}

export function listinaView(s: ListinaSnapshot, m: DocumentMeta): DocumentView {
  switch (s.kind) {
    case "delivery": return deliveryView(s, m);
    case "cash_in": case "cash_out": return cashView(s, m);
    case "reminder": return reminderView(s, m);
    case "claim": return claimView(s, m);
    case "amendment": return amendmentView(s, m);
  }
}

/** Částka, která se uloží k dokladu (přehledy, pokladna). */
export function listinaTotal(s: ListinaSnapshot): number {
  switch (s.kind) {
    case "delivery": return s.showPrices ? s.lines.reduce((a, l) => a + l.total, 0) : 0;
    case "cash_in": case "cash_out": return s.amount;
    case "reminder": return s.amountDue;
    case "claim": return 0;
    case "amendment": return s.priceNet === null ? 0 : s.vatMode === "standard" ? s.gross : s.priceNet;
  }
}
