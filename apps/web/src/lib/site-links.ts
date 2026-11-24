/** Hlavní odkazy veřejného webu – sdílí je hlavička (server) i mobilní menu (klient). */
export type SiteSection = "poptavky" | "pro-remeslniky" | "cenik" | "jak-to-funguje";

export const SITE_LINKS: { href: string; label: string; id: SiteSection }[] = [
  { href: "/poptavky", label: "Poptávky", id: "poptavky" },
  { href: "/pro-remeslniky", label: "Pro řemeslníky", id: "pro-remeslniky" },
  { href: "/cenik", label: "Ceník", id: "cenik" },
  { href: "/jak-to-funguje", label: "Jak to funguje", id: "jak-to-funguje" },
];
