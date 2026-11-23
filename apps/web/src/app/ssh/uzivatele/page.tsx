import type { Metadata } from "next";
import Link from "next/link";
import { adminDate, requireAdmin } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/labels";
import { BanForm } from "../BanForm";

export const metadata: Metadata = { title: "Uživatelé" };

interface Row {
  id: string; email: string; created_at: string | null; last_sign_in_at: string | null; banned: boolean; is_admin: boolean;
  companies: { id: string; name: string; role: "owner" | "office" | "worker" }[];
}

export default async function AdminUsers({ searchParams }: PageProps<"/ssh/uzivatele">) {
  const { supabase, user } = await requireAdmin();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const { data, error } = await supabase.rpc("admin_users", { p_search: search });
  if (error) throw new Error("Uživatele se nepodařilo načíst.");
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[26px] font-extrabold">Uživatelé <span className="text-muted">({rows.length})</span></h1>
        <form className="flex gap-2" role="search">
          <input name="q" defaultValue={search} className="field w-64" placeholder="E-mail" aria-label="Hledat uživatele" />
          <button className="btn-dark">Hledat</button>
        </form>
      </div>
      <p className="text-[13px] text-muted">Zablokovaný uživatel se nepřihlásí a jeho aktivní přihlášení se ukončí (již otevřená stránka mu může fungovat nejvýše hodinu).</p>
      <ul className="card divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {r.email}
                {r.is_admin && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">provozovatel</span>}
                {r.banned && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">zablokovaný</span>}
              </p>
              <p className="text-[13px] text-muted">
                registrace {adminDate(r.created_at)} · poslední přihlášení {adminDate(r.last_sign_in_at, true)}
              </p>
              {r.companies.length > 0 ? (
                <p className="text-[13px]">
                  {r.companies.map((c, i) => (
                    <span key={c.id}>{i > 0 && ", "}<Link className="text-accent-ink hover:underline" href={`/ssh/firmy/${c.id}`}>{c.name}</Link> <span className="text-muted">({ROLE_LABELS[c.role]})</span></span>
                  ))}
                </p>
              ) : <p className="text-[13px] text-muted">Bez firmy (nedokončená registrace)</p>}
            </div>
            {!r.is_admin && r.id !== user.id && <BanForm userId={r.id} banned={r.banned} />}
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-muted">Nic nenalezeno.</li>}
      </ul>
    </div>
  );
}
