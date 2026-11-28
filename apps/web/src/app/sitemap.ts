import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { SITE_URL } from "@/lib/site";
import { LANDINGS } from "@/lib/landings";
import type { InquiryList } from "@/lib/inquiries";
import { listProfessions } from "@/lib/professions";

// Mapa webu se obnovuje každou hodinu (nové poptávky), ne při každém dotazu robota.
export const revalidate = 3600;

/** Veřejné stránky a aktivní skutečné poptávky (ukázky ne – mají noindex). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/poptavky`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/poptavky/nova`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pro-remeslniky`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/caste-otazky`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/cenik`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/jak-to-funguje`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/kontakt`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/bezpecnost-dat`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/obchodni-podminky`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/ochrana-osobnich-udaju`, changeFrequency: "yearly", priority: 0.2 },
    ...LANDINGS.map((l) => ({ url: `${SITE_URL}/${l.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const items: MetadataRoute.Sitemap = [];
    for (let offset = 0; offset < 1000; offset += 50) {
      const { data, error } = await db.rpc("list_inquiries", { p_limit: 50, p_offset: offset });
      if (error || !data) break;
      const list = data as InquiryList;
      for (const q of list.items) items.push({ url: `${SITE_URL}/poptavky/${q.id}`, lastModified: q.created_at, changeFrequency: "weekly", priority: 0.6 });
      if (list.items.length < 50) break;
    }
    const professions = (await listProfessions()).map((p) => ({
      url: `${SITE_URL}/remeslnici/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.7,
    }));
    return [...pages, { url: `${SITE_URL}/remeslnici`, changeFrequency: "weekly", priority: 0.7 }, ...professions, ...items];
  } catch {
    return pages;
  }
}
