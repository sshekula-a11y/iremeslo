/** Návratová adresa jen v rámci webu (žádné //cizi.cz ani http://…). */
export function safeNext(value: unknown, fallback = "/app"): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

/** Návrat k veřejné poptávce po registraci (jen /poptavky/…, nic jiného nepřesměrujeme). */
export function inquiryReturn(value: unknown): string | null {
  const s = safeNext(value, "");
  return /^\/poptavky\/[0-9a-f-]{36}(\?kontakt=1)?$/i.test(s) ? s : null;
}
