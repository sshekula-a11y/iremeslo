/** Barevné varianty dokladů (companies.invoice_theme). accentText = barva textu na podkladu accent. */
export const THEMES = {
  oranzova: { label: "Oranžová", accent: "#fe820d", accentText: "#05264c" },
  svetlemodra: { label: "Světle modrá", accent: "#2b8fd6", accentText: "#ffffff" },
  zelena: { label: "Zelená", accent: "#1f7a4d", accentText: "#ffffff" },
  mono: { label: "Černobílá", accent: "#1f2933", accentText: "#ffffff" },
} as const;
export type ThemeKey = keyof typeof THEMES;
