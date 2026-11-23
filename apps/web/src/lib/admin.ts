import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Administrace provozovatele: kdo není v app.platform_admins, dostane 404 (stránka „neexistuje“). */
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_whoami");
  if (error || data !== true) notFound();
  return { user, supabase };
}

/** "2026-11-22T10:00:00+00:00" → "22. 11. 2026" (v pražském čase) */
export function adminDate(ts: string | null | undefined, withTime = false): string {
  if (!ts) return "—";
  const d = new Date(ts.length === 10 ? `${ts}T12:00:00Z` : ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export const ACTION_LABELS: Record<string, string> = {
  user_ban: "Zablokován uživatel",
  user_unban: "Odblokován uživatel",
  read_only_on: "Zapnut režim jen pro čtení",
  read_only_off: "Vypnut režim jen pro čtení",
  subscription: "Změna tarifu",
  payment: "Zapsaná platba",
  email_settings: "Změna nastavení e-mailů",
  verify_email: "Ručně potvrzený e-mail",
};

export const SUB_STATUS_LABELS: Record<string, string> = {
  trialing: "Zkušební",
  active: "Aktivní",
  past_due: "Po splatnosti",
  read_only: "Jen pro čtení",
  canceled: "Zrušené",
};
