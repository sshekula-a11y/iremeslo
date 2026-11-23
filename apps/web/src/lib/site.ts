import "server-only";
import { headers } from "next/headers";

/**
 * Adresa webu, na které uživatel právě je (např. https://iremeslo.cz nebo https://…vercel.app).
 * Odkazy v e-mailech tak vedou zpět na stejný web bez nastavování proměnných.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "https://iremeslo.cz";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
