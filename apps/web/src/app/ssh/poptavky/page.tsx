import type { Metadata } from "next";
import Link from "next/link";
import { adminDate, requireAdmin } from "@/lib/admin";
import { CATEGORY_LABEL, formatQuantity, type PublicInquiry } from "@/lib/inquiries";
import { ActionForm } from "../ActionForm";
import { setInquiryStatus } from "../actions";

export const metadata: Metadata = { title: "Poptávky" };

type AdminInquiry = PublicInquiry & { raw_status: string; contact_name: string; contact_email: string; contact_phone: string | null };

const STATUS: Record<string, [string, string]> = {
  pending: ["Čeká na potvrzení", "bg-paper text-muted"],
  open: ["Zveřejněná", "bg-ok-soft text-ok"],
  expired: ["Prošlá", "bg-paper text-muted"],
  closed: ["Uzavřená", "bg-paper text-muted"],
  hidden: ["Skrytá", "bg-warn-soft text-warn"],
};

export default async function AdminInquiries() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_inquiries");
  if (error) throw new Error("Poptávky se nepodařilo načíst.");
  const list = (data ?? []) as AdminInquiry[];
  const count = (s: string) => list.filter((q) => q.status === s).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Poptávky</h1>
        <p className="mt-1 text-[14px] text-muted">
          Zveřejněné {count("open")} · čeká na potvrzení {count("pending")} · uzavřené {count("closed")} · skryté {count("hidden")}.
          Nevhodnou poptávku skryjte; nepotvrzenou můžete zveřejnit ručně.
        </p>
      </div>
      {list.length ? (
        <ul className="space-y-3">
          {list.map((q) => {
            const [label, cls] = STATUS[q.status] ?? [q.status, "bg-paper"];
            return (
              <li key={q.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${cls}`}>{label}</span>
                  <span>{CATEGORY_LABEL[q.category] ?? q.category}</span>
                  <span>· {adminDate(q.created_at, true)}</span>
                  <span>· zobrazení kontaktu {q.views}</span>
                </div>
                <p className="mt-1 font-semibold">
                  {q.status === "open" ? <Link href={`/poptavky/${q.id}`} className="hover:underline">{q.title}</Link> : q.title}
                  <span className="font-normal text-muted"> · {q.city}{formatQuantity(q.quantity, q.unit) ? ` · ${formatQuantity(q.quantity, q.unit)}` : ""}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-[14px] text-muted">{q.description}</p>
                <p className="mt-1 break-all text-[13px]">{q.contact_name} · {q.contact_email}{q.contact_phone ? ` · ${q.contact_phone}` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.raw_status !== "open" && (
                    <ActionForm action={setInquiryStatus} submit={q.raw_status === "pending" ? "Zveřejnit" : "Znovu zveřejnit"} tone="ghost">
                      <input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="open" />
                    </ActionForm>
                  )}
                  {q.raw_status !== "hidden" && (
                    <ActionForm action={setInquiryStatus} submit="Skrýt" tone="danger">
                      <input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="hidden" />
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="card px-4 py-8 text-center text-muted">Zatím žádné poptávky.</p>}
    </div>
  );
}
