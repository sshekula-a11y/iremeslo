import { NextResponse } from "next/server";
import { isValidIco, normalizeIco } from "@iremeslo/core";
import { createClient } from "@/lib/supabase/server";
import type { AresCompany } from "@/lib/types";


interface AresSidlo {
  nazevUlice?: string;
  nazevCastiObce?: string;
  nazevObce?: string;
  cisloDomovni?: number;
  cisloOrientacni?: number;
  cisloOrientacniPismeno?: string;
  psc?: number;
}

/** Načtení firmy z ARES podle IČO (jen pro přihlášené, aby se služba nedala zneužít). */
export async function GET(_req: Request, ctx: RouteContext<"/api/ares/[ico]">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "Nejste přihlášený." }, { status: 401 });

  const { ico: raw } = await ctx.params;
  if (!isValidIco(raw)) return NextResponse.json({ error: "IČO není platné. Zkontrolujte číslice." }, { status: 400 });
  const ico = normalizeIco(raw);

  let res: Response;
  try {
    res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: "ARES teď neodpovídá. Údaje vyplňte ručně." }, { status: 502 });
  }
  if (res.status === 404) return NextResponse.json({ error: "Firmu s tímto IČO jsme v ARES nenašli." }, { status: 404 });
  if (!res.ok) return NextResponse.json({ error: "ARES teď neodpovídá. Údaje vyplňte ručně." }, { status: 502 });

  const j = (await res.json()) as { ico: string; obchodniJmeno: string; dic?: string; sidlo?: AresSidlo };
  const s = j.sidlo ?? {};
  const number = [s.cisloDomovni, s.cisloOrientacni ? `${s.cisloOrientacni}${s.cisloOrientacniPismeno ?? ""}` : null]
    .filter(Boolean)
    .join("/");
  const streetName = s.nazevUlice ?? s.nazevCastiObce ?? s.nazevObce ?? "";
  const company: AresCompany = {
    ico: j.ico,
    name: j.obchodniJmeno,
    dic: j.dic ?? null,
    street: [streetName, number].filter(Boolean).join(" "),
    city: s.nazevObce ?? "",
    zip: s.psc ? String(s.psc).replace(/^(\d{3})(\d{2})$/, "$1 $2") : "",
    vatPayer: Boolean(j.dic),
  };
  return NextResponse.json(company, { headers: { "cache-control": "private, max-age=3600" } });
}
