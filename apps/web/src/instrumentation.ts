import type { Instrumentation } from "next";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Chyby serveru (stránky, akce formulářů, API) → databáze (app.error_log). Stejné chyby se sčítají,
 * provozovateli chodí denní souhrn e-mailem a přehled je v administraci /ssh/chyby.
 * Neposíláme obsah formulářů ani hlavičky – jen druh chyby a cestu stránky (bez parametrů s tokeny).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/report_error`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_source: `${context.routeType}`,
        p_route: context.routePath || request.path.split("?")[0],
        p_message: message.slice(0, 1000),
        p_digest: digest,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Záznam chyby nesmí sám shodit odpověď.
  }
};
