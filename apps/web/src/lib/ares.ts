import "server-only";
import { isValidIco, normalizeIco } from "@iremeslo/core";
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

export type AresResult =
  | { ok: true; company: AresCompany }
  | { ok: false; reason: "invalid" | "not_found" | "unavailable" };

/** Firma z ARES podle IČO. „unavailable“ = ARES neodpovídá (pak se nesmí registrace kvůli tomu zablokovat). */
export async function lookupAres(raw: string): Promise<AresResult> {
  if (!isValidIco(raw)) return { ok: false, reason: "invalid" };
  const ico = normalizeIco(raw);
  let res: Response;
  try {
    res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "unavailable" };

  const j = (await res.json()) as {
    ico: string; obchodniJmeno: string; dic?: string; sidlo?: AresSidlo;
    seznamRegistraci?: { stavZdrojeDph?: string };
  };
  const s = j.sidlo ?? {};
  const number = [s.cisloDomovni, s.cisloOrientacni ? `${s.cisloOrientacni}${s.cisloOrientacniPismeno ?? ""}` : null]
    .filter(Boolean)
    .join("/");
  const streetName = s.nazevUlice ?? s.nazevCastiObce ?? s.nazevObce ?? "";
  return {
    ok: true,
    company: {
      ico: j.ico,
      name: j.obchodniJmeno,
      dic: j.dic ?? null,
      street: [streetName, number].filter(Boolean).join(" "),
      city: s.nazevObce ?? "",
      zip: s.psc ? String(s.psc).replace(/^(\d{3})(\d{2})$/, "$1 $2") : "",
      // Plátce DPH podle registru DPH; DIČ mají i neplátci (identifikované osoby), proto nestačí samotné DIČ.
      vatPayer: j.seznamRegistraci?.stavZdrojeDph ? j.seznamRegistraci.stavZdrojeDph === "AKTIVNI" : Boolean(j.dic),
    },
  };
}
