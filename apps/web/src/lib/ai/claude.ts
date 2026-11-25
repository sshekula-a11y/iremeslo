import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

/**
 * Napojení na Claude (Anthropic). Klíč je jen v proměnné prostředí ANTHROPIC_API_KEY na Vercelu –
 * nikdy v kódu ani v databázi. Bez klíče jsou funkce AI účetní vypnuté a aplikace to jen oznámí.
 */
export const AI_MODEL = "claude-opus-5-5";
/** Když Claude Opus 5.5 požadavek odmítne, API ho samo zkusí na záložním modelu (podle druhu odmítnutí). */
export const AI_BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 90_000 });
  return client;
}

export class AiError extends Error {}

/**
 * Jedno použití AI v rámci měsíčního limitu firmy: rezervuje ho v databázi, spustí volání
 * a zapíše výsledek (tokeny pro přehled nákladů). Nepovedené volání se do limitu nepočítá.
 */
export async function withAiQuota<T>(companyId: string, kind: "receipt" | "chat", run: () => Promise<{ value: T; usage?: { input_tokens: number; output_tokens: number }; model?: string }>): Promise<T> {
  if (!aiConfigured()) throw new AiError("AI účetní zatím není zapnutá – provozovatel ještě nenastavil přístup k AI.");
  const supabase = await createClient();
  const { data: rid, error } = await supabase.rpc("ai_reserve", { p_company: companyId, p_kind: kind });
  if (error || rid == null) {
    if (error?.message.includes("limit")) throw new AiError(kind === "receipt" ? "Tento měsíc jste vyčerpali limit čtení účtenek. Výdaj zadejte ručně, limit se obnoví 1. dne příštího měsíce." : "Tento měsíc jste vyčerpali limit dotazů na AI účetní. Obnoví se 1. dne příštího měsíce.");
    throw new AiError("AI teď nejde použít.");
  }
  try {
    const r = await run();
    await supabase.rpc("ai_finish", { p_id: rid, p_ok: true, p_input: r.usage?.input_tokens ?? 0, p_output: r.usage?.output_tokens ?? 0, p_model: r.model ?? AI_MODEL });
    return r.value;
  } catch (e) {
    await supabase.rpc("ai_finish", { p_id: rid, p_ok: false, p_input: 0, p_output: 0, p_model: AI_MODEL });
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new AiError("AI je teď přetížená. Zkuste to za chvíli.");
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("Přístup k AI není správně nastavený. Dejte prosím vědět provozovateli.");
    if (e instanceof Anthropic.APIConnectionError) throw new AiError("AI se nepodařilo spojit. Zkuste to znovu.");
    if (e instanceof Anthropic.APIError) throw new AiError("AI teď neodpověděla. Zkuste to znovu.");
    throw e;
  }
}
