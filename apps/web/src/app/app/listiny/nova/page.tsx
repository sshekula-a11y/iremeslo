import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayInPrague } from "@/lib/calendar";
import { toInput } from "@/lib/money";
import { loadListinaContext } from "@/lib/documents/listiny";
import { REMEDIES, type ListinaType } from "@/lib/documents/extra";
import { DOC_TYPE_LABELS } from "@/lib/documents/load";
import { ListinaForm } from "./ListinaForm";

export const metadata: Metadata = { title: "Nová listina" };

const TYPES: Record<string, ListinaType> = {
  "dodaci-list": "delivery", "prijmovy-doklad": "cash_in", "vydajovy-doklad": "cash_out",
  upominka: "reminder", vyzva: "reminder", reklamace: "claim", dodatek: "amendment",
};

/** Nová listina: dodací list, pokladní doklad, upomínka / předžalobní výzva, reklamace, dodatek ke smlouvě. */
export default async function NewListinaPage({ searchParams }: PageProps<"/app/listiny/nova">) {
  const sp = await searchParams;
  const typKey = typeof sp.typ === "string" ? sp.typ : "";
  const type = TYPES[typKey];
  if (!type) notFound();
  const company = await requireStaff();
  const jobId = typeof sp.zakazka === "string" ? sp.zakazka : null;
  const docId = typeof sp.doklad === "string" ? sp.doklad : null;
  const ctx = await loadListinaContext(company, type, { jobId, docId });
  const today = todayInPrague();
  const back = docId ? `/app/doklady/${docId}` : jobId ? `/app/zakazky/${jobId}` : "/app/pokladna";
  const heading = typKey === "vyzva" ? "Předžalobní výzva" : DOC_TYPE_LABELS[type];

  if ("error" in ctx) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={back} className="text-[14px] text-muted hover:text-ink">← Zpět</Link>
        <h1 className="font-display text-[24px] font-extrabold">{heading}</h1>
        <p className="card p-5 font-semibold text-warn">{ctx.error}</p>
      </div>
    );
  }

  // Náhled jako hotové PDF: barva, logo, razítko a podpis z nastavení
  const supabase = await createClient();
  const { data: firm } = await supabase.from("companies").select("invoice_theme, logo_path, stamp_path, signature_path").eq("id", company.id).single();
  const paths = [firm?.logo_path, firm?.stamp_path, firm?.signature_path].filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("files").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  const url = (p: string | null | undefined) => (p ? signed.get(p) ?? null : null);
  const meta = { number: "číslo po vystavení", issueDate: today, validUntil: null, theme: firm?.invoice_theme ?? "oranzova",
    logoUrl: url(firm?.logo_path), stampUrl: url(firm?.stamp_path), signatureUrl: url(firm?.signature_path) };

  const clients = type === "cash_in" || type === "cash_out"
    ? ((await supabase.from("clients").select("id, name, ico, street, city, zip").eq("company_id", company.id).order("name").limit(1000)).data ?? [])
    : [];

  const initial: Record<string, string> = {};
  if (type === "delivery") { initial.title = `Soupis provedených prací – ${ctx.job?.title ?? ""}`; initial.showPrices = "false"; }
  if (type === "cash_in" || type === "cash_out") {
    if (ctx.invoice) {
      initial.amount = toInput(ctx.invoice.amountDue); initial.purpose = `Úhrada faktury ${ctx.invoice.number}`; initial.relatedNumber = ctx.invoice.number;
    }
    if (ctx.customer && type === "cash_in") Object.assign(initial, { cpName: ctx.customer.name, cpIco: ctx.customer.ico ?? "", cpStreet: ctx.customer.street ?? "", cpCity: ctx.customer.city ?? "", cpZip: ctx.customer.zip ?? "" });
  }
  if (type === "reminder") { initial.level = typKey === "vyzva" ? "final" : "reminder"; initial.newDueDate = addDays(today, typKey === "vyzva" ? 10 : 7); }
  if (type === "claim") { initial.subject = ctx.job?.title ?? ctx.related?.label ?? ""; initial.claimedOn = today; initial.remedy = REMEDIES[0]; initial.consumer = String(!ctx.customer?.ico); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={back} className="text-[14px] text-muted hover:text-ink">← Zpět</Link>
        <h1 className="font-display text-[24px] font-extrabold">{heading}</h1>
      </div>
      <ListinaForm ctx={ctx} ids={{ jobId, docId }} meta={meta} today={today} initial={initial}
        clients={clients.map((c) => ({ id: c.id, name: c.name, ico: c.ico, street: c.street, city: c.city, zip: c.zip }))} />
    </div>
  );
}
