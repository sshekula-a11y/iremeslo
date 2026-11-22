import type { Metadata } from "next";
import { requireCompany } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Moje zakázky" };

/** Pracovník v terénu: jen přiřazené zakázky, bez cen a zisku. */
export default async function WorkerJobsPage() {
  await requireCompany();
  const supabase = await createClient();
  const { data: jobs } = await supabase.rpc("worker_jobs");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[26px] font-extrabold">Moje zakázky</h1>
      <div className="space-y-3">
        {jobs && jobs.length > 0 ? (
          jobs.map((j: { id: string; number: string; title: string; site_address: string | null; date_from: string | null; date_to: string | null; client_name: string | null; client_phone: string | null; map_url: string | null }) => (
            <article key={j.id} className="card p-4">
              <p className="num text-[13px] text-muted">{j.number}</p>
              <h2 className="font-display text-[18px] font-bold">{j.title}</h2>
              <p className="mt-1 text-[14px] text-muted">{formatDate(j.date_from)} – {formatDate(j.date_to)}</p>
              {j.site_address && (
                <a className="mt-2 inline-block text-[15px] text-accent-ink" target="_blank" rel="noreferrer" href={`https://mapy.cz/zakladni?q=${encodeURIComponent(j.site_address)}`}>
                  {j.site_address}
                </a>
              )}
              {j.client_phone && (
                <p className="mt-1 text-[14px]">
                  {j.client_name} · <a className="text-accent-ink" href={`tel:${j.client_phone}`}>{j.client_phone}</a>
                </p>
              )}
            </article>
          ))
        ) : (
          <p className="card px-4 py-10 text-center text-muted">Zatím vám nikdo nepřiřadil žádnou zakázku.</p>
        )}
      </div>
    </div>
  );
}
