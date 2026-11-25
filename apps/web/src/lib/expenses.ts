/** Výdaje (účtenky a přijaté faktury): kategorie a popisky – sdílené aplikací i AI. */
export const EXPENSE_CATEGORIES = [
  ["material", "Materiál"],
  ["subdodavky", "Subdodávky a služby"],
  ["phm", "Pohonné hmoty"],
  ["naradi", "Nářadí a vybavení"],
  ["auto", "Provoz auta (servis, pneu, dálnice)"],
  ["telefon", "Telefon a internet"],
  ["najem", "Nájem a energie"],
  ["pojisteni", "Pojištění"],
  ["reklama", "Reklama a web"],
  ["kancelar", "Kancelář a software"],
  ["jine", "Jiné"],
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number][0];
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES);

export const PAID_METHODS = [["card", "Kartou"], ["cash", "Hotově"], ["bank", "Převodem"], ["other", "Jinak"]] as const;
export type PaidMethod = (typeof PAID_METHODS)[number][0];
