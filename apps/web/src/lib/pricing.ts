/**
 * Veřejný ceník. Ceny musí odpovídat tabulce public.plans (zkusebni, zakladni, bez_limitu) –
 * podle ní provozovatel v /ssh zapisuje platby a hlídá počet uživatelů.
 * Vše bez DPH (obchodní podmínky čl. 4).
 */
export interface PublicPlan {
  id: "zkusebni" | "zakladni" | "bez_limitu";
  name: string;
  month: number | null;
  year: number | null;
  users: string;
  note: string;
}

export const PLANS: PublicPlan[] = [
  { id: "zkusebni", name: "Zkušební", month: 0, year: null, users: "bez omezení", note: "30 dní zdarma, jednou pro každé IČO" },
  { id: "zakladni", name: "Základní", month: 199, year: 1999, users: "1–5", note: "Pro živnostníky a menší party" },
  { id: "bez_limitu", name: "Bez limitu", month: 299, year: 2999, users: "bez omezení", note: "Pro firmy s více partami a kanceláří" },
];

/** Nejnižší měsíční cena placeného tarifu – pro texty „od … Kč měsíčně“. */
export const PRICE_FROM = 199;

/** 1999 → „1 999“ (pevná mezera mezi tisíci). */
export const kc = (n: number) => n.toLocaleString("cs-CZ").replace(/\s/g, " ");
