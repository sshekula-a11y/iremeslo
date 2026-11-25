import type { Metadata } from "next";
import Link from "next/link";
import type { InvoiceSnapshot } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { DOC_STATUS_LABELS, DOC_TYPE_LABELS, SIGNABLE_TYPES, loadDocument } from "@/lib/documents/load";
import { czk, formatDate } from "@/lib/format";
import { addDays, todayInPrague } from "@/lib/calendar";
import { DocumentPaper } from "@/components/DocumentPaper";
import { PdfDownload } from "@/components/PdfDownload";
import { DocStatusBadge, docState } from "@/components/DocStatusBadge";
import { IssueDdppButton, MarkPaidForm } from "./PaymentPanel";
import { SignPanel, type SignSlot } from "./SignPanel";

export const metadata: Metadata = { title: "Doklad" };

const FILE_PREFIX: Record<string, string> = {
  quote: "Nabidka", invoice: "Faktura", invoice_non_payer: "Faktura", advance: "Zalohova-faktura", ddpp: "Danovy-doklad",
  contract: "Smlouva-o-dilo", handover: "Predavaci-protokol", delivery: "Dodaci-list", cash_in: "Prijmovy-pokladni-doklad",
  cash_out: "Vydajovy-pokladni-doklad", reminder: "Upominka", claim: "Reklamacni-protokol", amendment: "Dodatek",
};
const METHOD_LABELS: Record<string, string> = { bank: "převodem", cash: "hotově", card: "kartou", other: "jinak" };

export default async function DocumentPage({ params, searchParams }: PageProps<"/app/doklady/[id]">) {
  const { id } = await params;
  const justIssued = (await searchParams).rychla === "1";
  const company = await requireStaff();
  const doc = await loadDocument(company.id, id);
  const today = todayInPrague();
  const payable = ["invoice", "invoice_non_payer", "advance"].includes(doc.type);
  const state = docState(doc.type, doc.status, doc.dueDate, today);
  const snap = doc.snapshot as InvoiceSnapshot;
  const payerAdvance = doc.type === "advance" && snap.vatPayer && snap.vatMode === "standard";
  const ddpp = doc.related.find((r) => r.type === "ddpp");
  const paidOn = doc.payments.map((p) => p.paid_on).sort().at(-1);

  // Podpis prstem: jen u listin s podpisovým polem a jen vystavených (ne stornovaných).
  const sv = doc.view.signatures;
  const signable = !!sv && (SIGNABLE_TYPES as readonly string[]).includes(doc.type) && doc.status !== "canceled";
  const party = snap as unknown as { supplier?: { name?: string; city?: string; ico?: string | null }; customer?: { name?: string; ico?: string | null } | null };
  const signedBy = (side: "supplier" | "customer") => {
    const x = doc.signatures.find((g) => g.side === side);
    return x ? { name: x.signerName, at: formatDate(x.signedAt.slice(0, 10)) } : null;
  };
  const slots: SignSlot[] = sv ? [
    { side: "supplier", label: sv.left, defaultName: party.supplier?.ico && !/s\.\s?r\.\s?o|a\.\s?s\.|spol\./i.test(party.supplier?.name ?? "") ? party.supplier?.name ?? "" : "", signed: signedBy("supplier") },
    ...(sv.right ? [{ side: "customer" as const, label: sv.right, defaultName: party.customer && !party.customer.ico ? party.customer.name ?? "" : "", signed: signedBy("customer") }] : []),
  ] : [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {doc.jobId && <Link href={`/app/zakazky/${doc.jobId}`} className="text-[14px] text-muted hover:text-ink">← Zakázka</Link>}
          <h1 className="font-display text-[24px] font-extrabold">{doc.type === "reminder" && (snap as unknown as { level?: string }).level === "final" ? "Předžalobní výzva" : DOC_TYPE_LABELS[doc.type]} <span className="num">{doc.number}</span></h1>
          {payable ? <DocStatusBadge state={state} /> : (
            <span className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-semibold text-muted ring-1 ring-line">{DOC_STATUS_LABELS[doc.status] ?? doc.status}</span>
          )}
        </div>
        <PdfDownload view={doc.view} fileName={`${FILE_PREFIX[doc.type] ?? "Doklad"}-${doc.number}.pdf`} />
      </div>

      {/* Navazující listiny */}
      {(payable || doc.type === "contract") && (
        <nav className="flex flex-wrap gap-2" aria-label="Navazující listiny">
          {payable && doc.status !== "paid" && <>
            <Link href={`/app/listiny/nova?typ=upominka&doklad=${doc.id}`} className="btn-ghost min-h-9 px-3 text-[14px]">Upomínka</Link>
            <Link href={`/app/listiny/nova?typ=vyzva&doklad=${doc.id}`} className="btn-ghost min-h-9 px-3 text-[14px]">Předžalobní výzva</Link>
            <Link href={`/app/listiny/nova?typ=prijmovy-doklad&doklad=${doc.id}`} className="btn-ghost min-h-9 px-3 text-[14px]">Příjmový pokladní doklad</Link>
          </>}
          {doc.type === "contract" && <Link href={`/app/listiny/nova?typ=dodatek&doklad=${doc.id}`} className="btn-ghost min-h-9 px-3 text-[14px]">Dodatek ke smlouvě</Link>}
          <Link href={`/app/listiny/nova?typ=reklamace&doklad=${doc.id}`} className="btn-ghost min-h-9 px-3 text-[14px]">Reklamace</Link>
        </nav>
      )}

      {justIssued && (
        // Po rychlé faktuře: hlavní je PDF pro zákazníka; další funkce jen nabídneme.
        <section className="card overflow-hidden" aria-label="Faktura vystavena">
          <div className="flex flex-wrap items-center gap-3 bg-ok-soft px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-ok font-bold text-white" aria-hidden="true">✓</span>
            <p className="font-semibold text-ok">Faktura {doc.number} je vystavená. Stáhněte PDF a pošlete ji zákazníkovi.</p>
          </div>
          {doc.jobId && (
            <p className="px-4 py-3 text-[14px] text-muted">
              Tip: faktura je uložená i jako zakázka. Když k ní doplníte materiál a čas, uvidíte, kolik jste na ní vydělali.{" "}
              <Link href={`/app/zakazky/${doc.jobId}`} className="font-semibold text-accent-ink hover:underline">Zobrazit zakázku →</Link>
            </p>
          )}
        </section>
      )}

      {payable && (
        <section className="card space-y-3 p-4" aria-label="Platba">
          {doc.status === "paid" ? (
            <div className="space-y-1">
              <p className="font-semibold text-ok">Zaplaceno</p>
              {doc.payments.map((p, i) => (
                <p key={i} className="num text-[14px] text-muted">{formatDate(p.paid_on)} · {czk(p.amount)} · {METHOD_LABELS[p.method] ?? p.method}</p>
              ))}
              {doc.payments.length === 0 && <p className="text-[14px] text-muted">Uhrazeno zálohami.</p>}
            </div>
          ) : (
            <>
              <p className="text-[14px]">
                K úhradě <span className="num font-semibold">{czk(doc.totalDue)}</span>
                {doc.dueDate && <> do <span className={state === "overdue" ? "font-semibold text-warn" : "font-semibold"}>{formatDate(doc.dueDate)}</span></>}
                {state === "overdue" && <span className="text-warn"> – po splatnosti</span>}
              </p>
              <MarkPaidForm documentId={doc.id} today={today} amount={czk(doc.totalDue)} ddppHint={payerAdvance} />
            </>
          )}

          {payerAdvance && doc.status === "paid" && !ddpp && (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-[14px]">K zaplacené záloze chybí daňový doklad k přijaté platbě.
                {paidOn && addDays(paidOn, 15) < today && <span className="text-warn"> Lhůta 15 dní od platby už uplynula.</span>}
              </p>
              <IssueDdppButton advanceId={doc.id} />
            </div>
          )}
        </section>
      )}

      {doc.related.length > 0 && (
        <section className="card" aria-label="Navázané doklady">
          <h2 className="border-b border-line px-4 py-2.5 text-[14px] font-semibold text-muted">Navázané doklady</h2>
          <ul className="divide-y divide-line">
            {doc.related.map((r) => (
              <li key={r.id}>
                <Link href={`/app/doklady/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper">
                  <span className="font-semibold">{DOC_TYPE_LABELS[r.type] ?? r.type} <span className="num">{r.number}</span></span>
                  <span className="text-[13px] text-muted">{r.type === "invoice" || r.type === "invoice_non_payer" ? "záloha je na ní odečtená" : r.type === "handover" ? "k podpisu při předání díla" : r.type === "contract" ? "smlouva, ke které protokol patří" : DOC_STATUS_LABELS[r.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[13px] text-muted">
        {doc.type === "quote"
          ? "Vystavený doklad už nejde měnit. Když se cena změní, upravte zakázku a vystavte novou nabídku."
          : doc.type === "contract"
            ? "Vystavená smlouva už nejde měnit. Podepište ji s objednatelem prstem níže, nebo stáhněte PDF, vytiskněte ho dvakrát a podepište na papíře. Změny řešte dodatkem nebo novou smlouvou."
            : doc.type === "handover"
              ? "Při předání díla protokol podepište s objednatelem prstem níže, nebo ho vytiskněte, vyplňte a podepište na papíře."
              : "Vystavený doklad už nejde měnit ani smazat."}
      </p>
      {signable && <SignPanel documentId={doc.id} slots={slots} defaultPlace={party.supplier?.city ?? ""} />}
      <DocumentPaper v={doc.view} />
    </div>
  );
}
