import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/** Stránka profese (/remeslnici/<slug>). Texty jsou v databázi a upravují se v /ssh/profese. */
export interface Profession {
  slug: string;
  name: string;
  category: string;
  meta_title: string;
  meta_description: string;
  intro: string;
  services: string[];
  price_factors: string[];
  tip: string | null;
  faq: { q: string; a: string }[];
  published?: boolean;
  sort: number;
  updated_at?: string;
}

/** Veřejné čtení bez přihlášení (bez cookies – stránky jde ukládat do mezipaměti). */
export function publicDb() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

export async function listProfessions(): Promise<Profession[]> {
  const { data } = await publicDb().from("professions").select("*").order("sort").order("name");
  return (data ?? []) as Profession[];
}

export async function getProfession(slug: string): Promise<Profession | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const { data } = await publicDb().from("professions").select("*").eq("slug", slug).maybeSingle();
  return (data as Profession | null) ?? null;
}
