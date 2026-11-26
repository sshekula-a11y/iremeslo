/**
 * Menu aplikace – jeden zdroj pro boční panel (počítač), výsuvné menu (telefon) a tlačítko „+ Nový“.
 * Skupiny jsou podle toho, jak řemeslník pracuje: práce → doklady → peníze a daně → adresář → nastavení.
 */
import type { IconName } from "@/components/Icon";

export interface NavItem { href: string; label: string; icon?: IconName; exact?: boolean; hint?: string }
export interface NavGroup { id: string; label: string; icon: IconName; items: NavItem[] }

export const NAV_HOME: NavItem = { href: "/app", label: "Přehled", icon: "home", exact: true };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "prace", label: "Zakázky", icon: "briefcase", items: [
      { href: "/app/zakazky", label: "Zakázky" },
      { href: "/app/kalendar", label: "Kalendář" },
      { href: "/poptavky", label: "Poptávky zákazníků" },
      { href: "/app/nabidky", label: "Odeslané nabídky" },
      { href: "/app/cenik", label: "Ceník prací a materiálu" },
    ],
  },
  {
    id: "doklady", label: "Doklady", icon: "file", items: [
      { href: "/app/faktury", label: "Faktury vydané" },
      { href: "/app/doklady", label: "Všechny doklady a listiny", exact: true },
      { href: "/app/faktury/import", label: "Převzít z jiného programu" },
      { href: "/app/faktury/export", label: "Export pro účetní" },
    ],
  },
  {
    id: "penize", label: "Peníze a daně", icon: "wallet", items: [
      { href: "/app/vydaje", label: "Výdaje a účtenky" },
      { href: "/app/pokladna", label: "Pokladna" },
      { href: "/app/ucetni", label: "Daně a odvody", hint: "AI účetní" },
    ],
  },
  {
    id: "adresar", label: "Adresář", icon: "users", items: [
      { href: "/app/zakaznici", label: "Zákazníci", exact: true },
      { href: "/app/zakaznici/import-export", label: "Import a export kontaktů" },
      { href: "/app/zamestnanci", label: "Zaměstnanci" },
    ],
  },
  {
    id: "nastaveni", label: "Nastavení", icon: "cog", items: [
      { href: "/app/nastaveni", label: "Firma a údaje", exact: true },
      { href: "/app/nastaveni/faktura", label: "Vzhled dokladů, logo a razítko" },
    ],
  },
];

/** Co jde rychle vytvořit z tlačítka „+ Nový“ (na počítači v panelu, na telefonu uprostřed dolní lišty). */
export const NEW_ITEMS: (NavItem & { icon: IconName })[] = [
  { href: "/app/faktury/rychla", label: "Faktura", icon: "file", hint: "rychle, bez zakázky" },
  { href: "/app/zakazky/nova", label: "Zakázka", icon: "briefcase", hint: "kalkulace, nabídka, smlouva" },
  { href: "/app/vydaje/novy", label: "Výdaj – vyfotit účtenku", icon: "camera", hint: "údaje se přečtou samy" },
  { href: "/app/listiny/nova?typ=prijmovy-doklad", label: "Příjmový pokladní doklad", icon: "cash" },
  { href: "/app/listiny/nova?typ=vydajovy-doklad", label: "Výdajový pokladní doklad", icon: "cash" },
  { href: "/app/zakaznici#novy-zakaznik", label: "Zákazník", icon: "users" },
];

export const WORKER_ITEMS: NavItem[] = [{ href: "/app/moje-zakazky", label: "Moje zakázky", icon: "briefcase" }];

export function isActive(path: string, item: NavItem): boolean {
  const href = item.href.split("?")[0];
  return item.exact ? path === href : path === href || path.startsWith(href + "/");
}

/** Nejdelší odpovídající položka – aby „Faktury vydané“ nesvítily na stránce „Převzít z jiného programu“. */
export function activeHref(path: string): string | null {
  let best: string | null = null;
  for (const it of [NAV_HOME, ...NAV_GROUPS.flatMap((g) => g.items), ...WORKER_ITEMS]) {
    if (isActive(path, it) && (!best || it.href.length > best.length)) best = it.href;
  }
  // detail dokladu patří k dokladům, nová listina taky
  if (!best && (path.startsWith("/app/doklady/") || path.startsWith("/app/listiny"))) best = "/app/doklady";
  return best;
}
