import "server-only";
import { isValidIco, normalizeIco } from "@iremeslo/core";
import type { AresCompany } from "@/lib/types";
import { formatRegisterEntry, TRADE_REGISTER_ENTRY, type SpisovaZnacka } from "@/lib/register-entry";

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
    seznamRegistraci?: { stavZdrojeDph?: string; stavZdrojeVr?: string; stavZdrojeRzp?: string };
  };
  const s = j.sidlo ?? {};
  const number = [s.cisloDomovni, s.cisloOrientacni ? `${s.cisloOrientacni}${s.cisloOrientacniPismeno ?? ""}` : null]
    .filter(Boolean)
    .join("/");
  const streetName = s.nazevUlice ?? s.nazevCastiObce ?? s.nazevObce ?? "";
  // Zápis v rejstříku: veřejný rejstřík (soud, oddíl, vložka), jinak živnostenský rejstřík.
  let registerEntry: string | null = null;
  if (j.seznamRegistraci?.stavZdrojeVr === "AKTIVNI") registerEntry = await lookupRegisterEntry(ico);
  if (!registerEntry && j.seznamRegistraci?.stavZdrojeRzp === "AKTIVNI" && j.seznamRegistraci?.stavZdrojeVr !== "AKTIVNI") registerEntry = TRADE_REGISTER_ENTRY;

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
      registerEntry,
    },
  };
}

/** Spisová značka z veřejného rejstříku (ARES VR). Když ARES neodpoví, vrátí null – údaj se pak doplní ručně. */
async function lookupRegisterEntry(ico: string): Promise<string | null> {
  try {
    const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/${ico}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { zaznamy?: { spisovaZnacka?: SpisovaZnacka[]; primarniZaznam?: boolean }[] };
    const zaznam = j.zaznamy?.find((z) => z.primarniZaznam) ?? j.zaznamy?.[0];
    return formatRegisterEntry(zaznam?.spisovaZnacka);
  } catch {
    return null;
  }
}
