import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { AI_MODEL, aiConfigured } from "@/lib/ai/claude";
import { ActionForm } from "../ActionForm";
import { saveAiLimits } from "../actions";

export const metadata: Metadata = { title: "AI účetní" };

interface Overview {
  receipts_limit: number;
  chat_limit: number;
  companies: { name: string; receipts: number; chat: number; failed: number; input_tokens: number; output_tokens: number }[];
}

// Ceník Claude Opus 5.5: 4 USD / 1 mil. vstupních a 20 USD / 1 mil. výstupních tokenů.
const usd = (i: number, o: number) => (i * 4 + o * 20) / 1_000_000;

export default async function AdminAi() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_ai_overview");
  if (error || !data) throw new Error("Přehled AI se nepodařilo načíst.");
  const s = data as Overview;
  const on = aiConfigured();
  const total = s.companies.reduce((a, c) => a + usd(c.input_tokens, c.output_tokens), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold">AI účetní</h1>
        <p className="mt-1 text-[14px] text-muted">Čtení účtenek a dotazy na AI účetní běží přes Claude (model {AI_MODEL}).</p>
      </div>

      <div className={`rounded-2xl px-4 py-3 text-[14px] ${on ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`} role="status">
        {on
          ? <>AI je zapnutá – klíč Anthropic je nastavený na Vercelu.</>
          : <><strong>AI je vypnutá</strong> – na Vercelu chybí proměnná <span className="num">ANTHROPIC_API_KEY</span>. Výdaje jde zadávat ručně, účtenky se ukládají, ale nečtou.</>}
      </div>
      {!on && (
        <section className="card space-y-2 p-4 text-[14px]" aria-labelledby="zapnout">
          <h2 id="zapnout" className="font-display text-[17px] font-bold">Jak AI zapnout</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Na <strong>console.anthropic.com</strong> si vytvořte účet, nastavte platbu a limit útraty a vytvořte API klíč.</li>
            <li>Ve <strong>Vercelu</strong> otevřete projekt → Settings → Environment Variables a přidejte <span className="num">ANTHROPIC_API_KEY</span> s klíčem (prostředí Production, označit jako Sensitive).</li>
            <li>Spusťte nové nasazení (Redeploy). Klíč nikam jinam nevkládejte – ani do chatu.</li>
          </ol>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <section className="card p-4" aria-labelledby="limity">
          <h2 id="limity" className="font-display text-[17px] font-bold">Měsíční limity na firmu</h2>
          <ActionForm action={saveAiLimits} submit="Uložit" tone="primary" className="mt-3">
            <div>
              <label className="label" htmlFor="receipts">Přečtených účtenek</label>
              <input className="field num" id="receipts" name="receipts" type="number" min={0} max={100000} defaultValue={s.receipts_limit} />
            </div>
            <div>
              <label className="label" htmlFor="chat">Dotazů na AI účetní</label>
              <input className="field num" id="chat" name="chat" type="number" min={0} max={100000} defaultValue={s.chat_limit} />
            </div>
          </ActionForm>
          <p className="mt-2 text-[13px] text-muted">Limit platí pro kalendářní měsíc. Nepovedená volání se nepočítají.</p>
        </section>

        <section className="card overflow-x-auto p-4" aria-labelledby="spotreba">
          <h2 id="spotreba" className="font-display text-[17px] font-bold">Spotřeba tento měsíc</h2>
          <p className="text-[13px] text-muted">Odhad nákladů podle ceníku Anthropic: <span className="num font-semibold text-ink">{total.toFixed(2)} USD</span></p>
          {s.companies.length === 0 ? <p className="mt-3 text-[14px] text-muted">Zatím nikdo AI nepoužil.</p> : (
            <table className="mt-3 w-full text-[14px]">
              <thead className="text-left text-[12px] uppercase text-muted">
                <tr><th className="py-1 pr-3">Firma</th><th className="pr-3 text-right">Účtenky</th><th className="pr-3 text-right">Dotazy</th><th className="pr-3 text-right">Chyby</th><th className="text-right">USD</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.companies.map((c) => (
                  <tr key={c.name}>
                    <td className="py-1.5 pr-3">{c.name}</td>
                    <td className="num pr-3 text-right">{c.receipts}</td>
                    <td className="num pr-3 text-right">{c.chat}</td>
                    <td className="num pr-3 text-right">{c.failed}</td>
                    <td className="num text-right">{usd(c.input_tokens, c.output_tokens).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
