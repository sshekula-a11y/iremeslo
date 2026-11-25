/**
 * Údaj o zápisu podnikatele do rejstříku pro doklady (§ 435 občanského zákoníku):
 * u zapsaných ve veřejném rejstříku soud, oddíl a vložka; u živnostníků zápis v živnostenském rejstříku.
 * Zdroj: ARES (ekonomicke-subjekty-vr – spisová značka).
 */

/** Rejstříkové soudy v ARES → 7. pád („vedeném …“). */
const COURTS: Record<string, string> = {
  MSPH: "Městským soudem v Praze",
  KSCB: "Krajským soudem v Českých Budějovicích",
  KSPL: "Krajským soudem v Plzni",
  KSUL: "Krajským soudem v Ústí nad Labem",
  KSHK: "Krajským soudem v Hradci Králové",
  KSBR: "Krajským soudem v Brně",
  KSOS: "Krajským soudem v Ostravě",
};

/** Oddíl spisové značky → druh veřejného rejstříku (6. pád). */
function registerName(oddil: string): string {
  const o = oddil.trim().toUpperCase();
  if (o === "L") return "spolkovém rejstříku";
  if (o === "N") return "nadačním rejstříku";
  if (o === "U") return "rejstříku ústavů";
  if (o === "S") return "rejstříku společenství vlastníků jednotek";
  if (o === "O") return "rejstříku obecně prospěšných společností";
  return "obchodním rejstříku";
}

export interface SpisovaZnacka { soud?: string; oddil?: string; vlozka?: number | string; datumVymazu?: string | null }

/** „Zapsáno v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 55087“ */
export function formatRegisterEntry(zaznamy: SpisovaZnacka[] | undefined | null): string | null {
  const current = (zaznamy ?? []).filter((z) => z.oddil && z.vlozka && !z.datumVymazu).at(-1);
  if (!current) return null;
  const court = current.soud ? COURTS[current.soud.toUpperCase()] : undefined;
  const reg = registerName(current.oddil!);
  return `Zapsáno ${/^[sz]/.test(reg) ? "ve" : "v"} ${reg}${court ? ` vedeném ${court}` : ""}, oddíl ${current.oddil!.trim()}, vložka ${current.vlozka}`;
}

export const TRADE_REGISTER_ENTRY = "Zapsán v živnostenském rejstříku";
