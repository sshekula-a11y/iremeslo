import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupAres } from "@/lib/ares";

/** Načtení firmy z ARES podle IČO (jen pro přihlášené, aby se služba nedala zneužít). */
export async function GET(_req: Request, ctx: RouteContext<"/api/ares/[ico]">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "Nejste přihlášený." }, { status: 401 });

  const { ico } = await ctx.params;
  const r = await lookupAres(ico);
  if (r.ok) return NextResponse.json(r.company, { headers: { "cache-control": "private, max-age=3600" } });
  if (r.reason === "invalid") return NextResponse.json({ error: "IČO není platné. Zkontrolujte číslice." }, { status: 400 });
  if (r.reason === "not_found") return NextResponse.json({ error: "Firmu s tímto IČO jsme v ARES nenašli." }, { status: 404 });
  return NextResponse.json({ error: "ARES teď neodpovídá. Údaje vyplňte ručně." }, { status: 502 });
}
