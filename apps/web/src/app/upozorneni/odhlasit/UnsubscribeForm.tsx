"use client";

import { useActionState } from "react";
import Link from "next/link";
import { unsubscribe, type UnsubState } from "./actions";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<UnsubState, FormData>(unsubscribe, {});
  if (state.done) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status">
          Hotovo – upozornění na nové poptávky{state.firm ? <> pro <strong>{state.firm}</strong></> : ""} jsme vypnuli.
        </p>
        <p className="text-[14px] text-muted">Znovu je zapnete kdykoli v aplikaci v Nastavení → Upozornění na nové poptávky.</p>
        <Link href="/app/nastaveni#upozorneni" className="btn-ghost">Otevřít nastavení</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="t" value={token} />
      <p className="text-muted">Nechcete dostávat e-maily o nových poptávkách? Vypněte je jedním klepnutím. Místo vypnutí můžete v nastavení zvolit jen souhrn jednou denně nebo vybrané kraje.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Vypínám…" : "Vypnout upozornění"}</button>
        <Link href="/app/nastaveni#upozorneni" className="btn-ghost">Upravit nastavení</Link>
      </div>
      {state.error && <p className="text-[14px] font-semibold text-warn" role="alert">{state.error}</p>}
    </form>
  );
}
