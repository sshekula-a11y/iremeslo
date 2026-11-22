import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "office" | "worker";

export interface CurrentUser {
  id: string;
  email: string | null;
}

export interface ActiveCompany {
  id: string;
  name: string;
  ico: string | null;
  vatPayer: boolean;
  defaultVatRate: 0 | 12 | 21;
  materialMarkupPct: string;
  minMarginPct: string;
  role: Role;
}

const COMPANY_COOKIE = "firma";

/** Přihlášený uživatel (ověřený token), jinak přesměrování na přihlášení. */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/prihlaseni");
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
}

/** Firma, ve které uživatel právě pracuje. Bez firmy → registrace firmy. */
export async function requireCompany(): Promise<ActiveCompany> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, companies(id, name, ico, vat_payer, default_vat_rate, material_markup_pct, min_margin_pct)")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((r) => r.companies);
  if (rows.length === 0) redirect("/registrace-firmy");

  const wanted = (await cookies()).get(COMPANY_COOKIE)?.value;
  const row = rows.find((r) => (r.companies as unknown as { id: string }).id === wanted) ?? rows[0]!;
  const c = row.companies as unknown as {
    id: string;
    name: string;
    ico: string | null;
    vat_payer: boolean;
    default_vat_rate: 0 | 12 | 21;
    material_markup_pct: string;
    min_margin_pct: string;
  };
  return {
    id: c.id,
    name: c.name,
    ico: c.ico,
    vatPayer: c.vat_payer,
    defaultVatRate: c.default_vat_rate,
    materialMarkupPct: String(c.material_markup_pct),
    minMarginPct: String(c.min_margin_pct),
    role: row.role as Role,
  };
}

/** Majitel a kancelář; pracovník jde na svůj přehled. */
export async function requireStaff(): Promise<ActiveCompany> {
  const company = await requireCompany();
  if (company.role === "worker") redirect("/app/moje-zakazky");
  return company;
}
