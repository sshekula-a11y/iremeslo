import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { summarizeJob } from "@iremeslo/core";
import { requireStaff } from "@/lib/data";
import { addDays, todayInPrague } from "@/lib/calendar";
import { prepareAdvance, prepareInvoice } from "@/lib/documents/prepare";
import { invoiceView } from "@/lib/documents/view";
import { createClient } from "@/lib/supabase/server";
import { DocumentPaper } from "@/components/DocumentPaper";
import { draftToJob } from "@/app/app/zakazky/summary";
import { IssueAdvanceForm, IssueInvoiceForm } from "./IssueForms";
import { ContractForm } from "./ContractForm";
import { ImageSlot } from "@/app/app/nastaveni/ImageSlot";
import { loadDraft } from "@/app/app/zakazky/load";
import { loadParties } from "@/lib/documents/parties";
import { toInput } from "@/lib/money";
import type { ActiveCompany } from "@/lib/data";

export const metadata: Metadata = { title: "Vystavit doklad" };

export default async function NewDocumentPage({ searchParams }: PageProps<"/app/doklady/nova">) {
  const sp = await searchParams;
  const jobId = typeof sp.zakazka === "string" ? sp.zakazka : "";
  const type = sp.typ === "zaloha" ? "advance" : sp.typ === "faktura" ? "invoice" : sp.typ === "smlouva" ? "contract" : null;
  if (!/^[0-9a-f-]{36}$/.test(jobId) || !type) notFound();
  const company = await requireStaff();
  const today = todayInPrague();
  if (type === "contract") return <ContractPage company={company} jobId={jobId} today={today} />;

  const prepared = type === "invoice" ? await prepareInvoice(company, jobId) : await prepareAdvance(company, jobId, { kind: "percent", value: "30" });
  const back = <Link href={`/app/zakazky/${jobId}`} className="text-[14px] text-muted hover:text-ink">← Zakázka</Link>;
  const heading = type === "invoice" ? "Vystavit fakturu" : "Vystavit zálohovou fakturu";

  if (!prepared.ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3">{back}<h1 className="font-display text-[24px] font-extrabold">{heading}</h1></div>
        <div className="card space-y-3 p-5">
          <p className="font-semibold text-warn">{prepared.error}</p>
          <Link href={`/app/zakazky/${jobId}`} className="btn-ghost">Zpět na zakázku</Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: firm } = await supabase.from("companies").select("invoice_theme").eq("id", company.id).single();
  const p = prepared;
  const warnings = p.warnings.length > 0 && (
    <ul className="space-y-1 rounded-xl border border-[#f3d9b1] bg-accent-soft p-3 text-[14px]">
      {p.warnings.map((w) => <li key={w}>{w}</li>)}
    </ul>
  );

  if (type === "advance") {
    const s = summarizeJob(draftToJob(p.draft, company.minMarginPct));
    const payer = p.snapshot.vatMode === "standard";
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3">{back}<h1 className="font-display text-[24px] font-extrabold">{heading}</h1></div>
        <p className="text-[14px] text-muted">{p.draft.title} · {p.snapshot.customer.name} · splatnost {p.termsDays} dní</p>
        {warnings}
        <IssueAdvanceForm jobId={jobId} gross={payer ? s.gross : s.revenue.net} grossLabel={payer ? "s DPH" : ""} />
      </div>
    );
  }

  const defaultTaxable = p.draft.dateTo && p.draft.dateTo <= today ? p.draft.dateTo : today;
  const view = invoiceView(p.snapshot, {
    number: "(přidělí se)",
    issueDate: today,
    validUntil: null,
    taxableDate: defaultTaxable,
    dueDate: addDays(today, p.termsDays),
    theme: firm?.invoice_theme ?? "oranzova",
    logoUrl: null,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">{back}<h1 className="font-display text-[24px] font-extrabold">{heading}</h1></div>
      <p className="text-[14px] text-muted">Náhled faktury z uložené zakázky. Číslo, QR Platba a logo se doplní při vystavení.</p>
      {warnings}
      <IssueInvoiceForm jobId={jobId} defaultTaxableDate={defaultTaxable} minDate={addDays(today, -366)} maxDate={addDays(today, 31)} showTaxable={p.snapshot.vatPayer} />
      <DocumentPaper v={view} />
    </div>
  );
}

/** Smlouva o dílo ze zakázky: předvyplněné údaje, logo a razítko s podpisem z nastavení, živý náhled. */
async function ContractPage({ company, jobId, today }: { company: ActiveCompany; jobId: string; today: string }) {
  const supabase = await createClient();
  const [draft, { data: firm }] = await Promise.all([
    loadDraft(company.id, jobId),
    supabase.from("companies").select("invoice_theme, logo_path, stamp_path, signature_path, payment_terms_days").eq("id", company.id).single(),
  ]);
  const parties = await loadParties(company.id, draft.clientId || null);
  const back = <Link href={`/app/zakazky/${jobId}`} className="text-[14px] text-muted hover:text-ink">← Zakázka</Link>;
  const header = <div className="flex items-center gap-3">{back}<h1 className="font-display text-[24px] font-extrabold">Smlouva o dílo</h1></div>;

  if (!parties.customer) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        <div className="card space-y-3 p-5">
          <p className="font-semibold text-warn">Zakázka nemá zákazníka. Smlouva musí mít objednatele – vyberte ho u zakázky a uložte ji.</p>
          <Link href={`/app/zakazky/${jobId}`} className="btn-ghost">Doplnit zákazníka</Link>
        </div>
      </div>
    );
  }

  // Obrázky firmy (soukromé úložiště, odkaz na hodinu) – stejné jako na nabídkách a fakturách.
  const paths = [firm?.logo_path, firm?.stamp_path, firm?.signature_path].filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("files").createSignedUrls(paths, 60 * 60);
    for (const x of data ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl);
  }
  const url = (p: string | null | undefined) => (p ? signed.get(p) ?? null : null);

  const summary = summarizeJob(draftToJob(draft, company.minMarginPct));
  const lines = [
    ...draft.work.filter((w) => w.description.trim()).map((w) => `– ${w.description.trim()}${w.qty ? ` – ${w.qty} ${w.unit}` : ""}`),
    ...draft.materials.filter((m) => m.description.trim() && m.billable).map((m) => `– ${m.description.trim()}${m.qty ? ` – ${m.qty} ${m.unit}` : ""}`),
  ];
  const canEdit = company.role === "owner";

  return (
    <div className="space-y-4">
      {header}
      <p className="text-[14px] text-muted">{draft.title} · objednatel {parties.customer.name}. Údaje jsme předvyplnili ze zakázky.</p>
      <ContractForm
        jobId={jobId}
        initial={{
          title: draft.title,
          subject: lines.length ? `Dílo zahrnuje tyto práce a dodávky:\n${lines.join("\n")}` : draft.title,
          price: toInput(summary.revenue.net),
          dateFrom: draft.dateFrom,
          dateTo: draft.dateTo,
          siteAddress: draft.siteAddress,
          advancePct: "0",
          paymentTermsDays: String(firm?.payment_terms_days ?? 14),
          warrantyMonths: "24",
          notes: "",
        }}
        supplier={parties.supplier}
        customer={parties.customer}
        vatPayer={parties.vatPayer}
        vatMode={draft.vatMode}
        vatRate={draft.vatRate}
        meta={{
          number: "(přidělí se)", issueDate: today, validUntil: null, theme: firm?.invoice_theme ?? "oranzova",
          logoUrl: url(firm?.logo_path), stampUrl: url(firm?.stamp_path), signatureUrl: url(firm?.signature_path),
        }}
      >
        <section className="card space-y-3 p-4" aria-labelledby="obrazky">
          <h2 id="obrazky" className="font-display text-[17px] font-bold">Logo a razítko s podpisem</h2>
          <p className="text-[13px] text-muted">
            Stejné jako na nabídkách a fakturách – co nahrajete tady nebo v nastavení, objeví se na všech PDF.
            Razítko s podpisem stačí vyfotit telefonem na bílém papíře.
          </p>
          <ImageSlot companyId={company.id} kind="logo" label="Logo" hint="Vlevo nahoře na dokladech" url={url(firm?.logo_path)} canEdit={canEdit} />
          <ImageSlot companyId={company.id} kind="stamp" label="Razítko s podpisem" hint="U podpisu zhotovitele" url={url(firm?.stamp_path)} canEdit={canEdit} />
          {!canEdit && <p className="text-[13px] text-muted">Obrázky může měnit jen majitel firmy.</p>}
        </section>
      </ContractForm>
    </div>
  );
}
