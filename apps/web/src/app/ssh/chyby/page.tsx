import type { Metadata } from "next";
import { adminDate, requireAdmin } from "@/lib/admin";
import { ActionForm } from "../ActionForm";
import { setErrorHandled } from "../actions";

export const metadata: Metadata = { title: "Chyby webu" };

interface ErrorRow { id: number; source: string; route: string | null; message: string; digest: string | null; first_at: string; last_at: string; count: number; handled_at: string | null }

const SOURCE: Record<string, string> = { render: "Zobrazení stránky", action: "Akce formuláře", route: "API", proxy: "Proxy" };

export default async function AdminErrors() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_errors");
  if (error) throw new Error("Chyby se nepodařilo načíst.");
  const list = (data ?? []) as ErrorRow[];
  const open = list.filter((e) => !e.handled_at);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Chyby webu</h1>
        <p className="mt-1 text-[14px] text-muted">
          Chyby serveru se zapisují samy, stejné se sčítají. Souhrn nevyřešených chodí každé ráno e-mailem. {open.length ? `Nevyřešené: ${open.length}.` : "Nic nevyřešeného."}
        </p>
      </div>
      {list.length === 0 ? (
        <p className="card p-5 text-[15px] text-muted">Zatím žádné chyby.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((e) => (
            <li key={e.id} className={`card p-4 ${e.handled_at ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{e.route ?? "–"} <span className="font-normal text-muted">· {SOURCE[e.source] ?? e.source}</span></p>
                <p className="text-[13px] text-muted"><strong className="text-ink">{e.count}×</strong> · naposledy {adminDate(e.last_at, true)}</p>
              </div>
              <p className="mt-2 break-words font-mono text-[13px]">{e.message}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-muted">poprvé {adminDate(e.first_at, true)}{e.digest ? ` · digest ${e.digest}` : ""}</p>
                <ActionForm action={setErrorHandled} submit={e.handled_at ? "Vrátit mezi nevyřešené" : "Označit jako vyřešené"} tone="ghost">
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="handled" value={e.handled_at ? "false" : "true"} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
