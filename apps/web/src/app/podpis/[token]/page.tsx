import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { DocumentPaper } from "@/components/DocumentPaper";
import { PdfDownload } from "@/components/PdfDownload";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPE_LABELS, buildView, withSignatures, type SignatureRow } from "@/lib/documents/load";
import { formatDate } from "@/lib/format";
import { RemoteSign } from "./RemoteSign";

export const metadata: Metadata = { title: "Podpis dokumentu", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type SignRequest =
  | { state: "invalid" }
  | { state: "expired"; supplier: string | null }
  | {
      state: "open" | "signed";
      expires_at: string;
      theme: string | null;
      document: { type: string; number: string; issue_date: string | null; taxable_date: string | null; due_date: string | null; valid_until: string | null; snapshot: Record<string, unknown> };
      signatures: SignatureRow[];
    };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="card space-y-2 p-6">
          <h1 className="font-display text-[24px] font-extrabold">{title}</h1>
          <div className="text-muted">{children}</div>
        </div>
      </div>
    </main>
  );
}

/** Veřejná stránka, kde zákazník přes odkaz od řemeslníka přečte listinu a podepíše ji prstem. */
export default async function SignPage({ params }: PageProps<"/podpis/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_sign_request", { p_token: token });
  const r = (data ?? { state: "invalid" }) as SignRequest;

  if (r.state === "invalid") {
    return <Notice title="Odkaz neplatí">Odkaz k podpisu je neplatný nebo ho odesílatel zrušil. Požádejte ho o nový.</Notice>;
  }
  if (r.state === "expired") {
    return <Notice title="Platnost odkazu vypršela">Odkaz k podpisu už neplatí. Požádejte {r.supplier ? <strong className="text-ink">{r.supplier}</strong> : "odesílatele"} o nový.</Notice>;
  }

  const d = r.document;
  const base = await buildView(d.type, d.snapshot, d.number, d.due_date, {
    number: d.number, issueDate: d.issue_date, validUntil: d.valid_until, taxableDate: d.taxable_date, dueDate: d.due_date,
    theme: r.theme ?? "oranzova", logoUrl: null, stampUrl: null, signatureUrl: null,
  });
  const { view, signatures } = withSignatures(base, r.signatures);
  const label = DOC_TYPE_LABELS[d.type] ?? "Dokument";
  const supplier = (d.snapshot.supplier as { name?: string } | undefined)?.name ?? "Dodavatel";
  const customer = d.snapshot.customer as { name?: string; ico?: string | null } | null | undefined;
  const customerSigned = signatures.find((s) => s.side === "customer");
  const fileName = `${label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}-${d.number}.pdf`;

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="podpis-h">
          {customerSigned ? (
            <>
              <h1 id="podpis-h" className="font-display text-[24px] font-extrabold text-ok">Podepsáno ✓</h1>
              <p>Děkujeme, {label.toLowerCase()} <span className="num">{d.number}</span> je podepsaný ({customerSigned.signerName}). {supplier} o tom dostal zprávu.</p>
              <PdfDownload view={view} fileName={fileName} />
            </>
          ) : (
            <>
              <h1 id="podpis-h" className="font-display text-[24px] font-extrabold">{label} <span className="num">{d.number}</span> k podpisu</h1>
              <p className="text-muted">
                <strong className="text-ink">{supplier}</strong> vám posílá dokument k podpisu. Přečtěte si ho níže a podepište prstem – nic neinstalujete ani se neregistrujete.
                Odkaz platí do {formatDate(r.expires_at.slice(0, 10))}.
              </p>
              {view.signatures && <RemoteSign token={token} label={view.signatures.right || "Zákazník"} defaultName={customer && !customer.ico ? customer.name ?? "" : ""} />}
            </>
          )}
        </section>
        <DocumentPaper v={view} />
        {!customerSigned && view.signatures && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-[14px] text-muted">Přečetli jste dokument? Podpis se uloží s časem a otiskem dokumentu a nejde ho později změnit.</p>
            <RemoteSign token={token} label={view.signatures.right || "Zákazník"} defaultName={customer && !customer.ico ? customer.name ?? "" : ""} />
          </div>
        )}
      </div>
    </main>
  );
}
