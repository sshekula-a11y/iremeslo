import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Vystavit fakturu" };

// Dokončené zakázky nahoru – ty se fakturují nejčastěji.
const ORDER: Record<string, number> = { done: 0, in_progress: 1, approved: 2, quote_sent: 3, inquiry: 4 };

interface JobRow {
  id: string; number: string; title: string; status: JobStatus; date_to: string | null; client_id: string | null;
  clients: { name: string } | null;
}

/** Výběr zakázky k fakturaci: faktura se skládá z položek, klienta a DPH uložené zakázky. */
export default async function NewInvoicePicker({ searchParams }: PageProps<"/app/faktury/nova">) {
  const company = await requireStaff();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 80).replace(/[%,()]/g, "") : "";
  const supabase = await createClient();

  let query = supabase
    .from("jobs")
    .select("id, number, title, status, date_to, client_id, clients(name)")
    .eq("company_id", company.id)
    .not("status", "in", "(rejected,invoiced,paid)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (search) query = query.or(`title.ilike.%${search}%,number.ilike.%${search}%`);
  const [{ data: jobs }, { data: invoiced }] = await Promise.all([
    query,
    supabase.from("documents").select("job_id").eq("company_id", company.id)
      .in("type", ["invoice", "invoice_non_payer"]).neq("status", "canceled").not("number", "is", null),
  ]);
  const done = new Set((invoiced ?? []).map((d) => d.job_id));
  const rows = ((jobs ?? []) as unknown as JobRow[])
    .filter((j) => !done.has(j.id))
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/app/faktury" className="text-[14px] text-muted hover:text-ink">← Faktury</Link>
        <h1 className="font-display text-[26px] font-extrabold">Vystavit fakturu</h1>
        <p className="text-[14px] text-muted">Vyberte zakázku. Položky, klient i DPH se na fakturu převezmou ze zakázky a před vystavením uvidíte náhled.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex gap-2" role="search">
          <input name="q" defaultValue={search} className="field w-64" placeholder="Hledat zakázku" aria-label="Hledat zakázku" />
          <button className="btn-ghost">Hledat</button>
        </form>
        <Link href="/app/faktury/rychla" className="btn-ghost">Faktura bez zakázky</Link>
      </div>

      <ul className="card divide-y divide-line">
        {rows.map((j) => (
          <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <Link href={`/app/zakazky/${j.id}`} className="block truncate font-semibold hover:text-accent-ink">{j.title}</Link>
              <p className="truncate text-[13px] text-muted">
                <span className="num">{j.number}</span> · {j.clients?.name ?? "Bez klienta"}
                {j.date_to ? ` · do ${formatDate(j.date_to)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={j.status} />
              {j.client_id ? (
                <>
                  <Link href={`/app/doklady/nova?zakazka=${j.id}&typ=zaloha`} className="btn-ghost min-h-9 px-3 text-[14px]">Záloha</Link>
                  <Link href={`/app/doklady/nova?zakazka=${j.id}&typ=faktura`} className="btn-primary min-h-9 px-3 text-[14px]">Vystavit fakturu</Link>
                </>
              ) : (
                <Link href={`/app/zakazky/${j.id}`} className="btn-ghost min-h-9 px-3 text-[14px]" title="Faktura musí mít odběratele">Doplnit klienta</Link>
              )}
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-10 text-center">
            <p className="text-muted">{search ? "Žádná zakázka k fakturaci neodpovídá hledání." : "Nemáte žádnou zakázku k fakturaci."}</p>
            <p className="mt-1 text-[14px] text-muted">Fakturu ale vystavíte i bez zakázky – stačí odběratel a položky.</p>
            <Link href="/app/faktury/rychla" className="btn-primary mt-4">+ Vystavit fakturu</Link>
          </li>
        )}
      </ul>
      <p className="text-[13px] text-muted">Vyfakturované, zaplacené a zamítnuté zakázky se tu nezobrazují.</p>
    </div>
  );
}
