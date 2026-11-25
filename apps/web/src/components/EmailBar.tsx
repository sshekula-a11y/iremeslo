"use client";

import { useActionState } from "react";
import { resendVerification, type ResendState } from "@/lib/email-status";

export interface EmailStatus {
  verified: boolean;
  email: string | null;
}

/** Pruh nahoře v aplikaci, dokud člověk nepotvrdí e-mail. Bez potvrzení nejde vystavit fakturu. */
export function EmailBar({ status }: { status: EmailStatus | null }) {
  const [state, action, pending] = useActionState<ResendState>(resendVerification, {});
  if (!status || status.verified) return null;

  return (
    <div className="border-b border-accent/30 bg-accent-soft">
      <form action={action} className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-[13px]">
        <p className="min-w-0 flex-1">
          <strong>Potvrďte svůj e-mail.</strong>{" "}
          <span className="sm:hidden">Bez potvrzení nevystavíte fakturu.</span>
          <span className="hidden sm:inline">Odkaz jsme vám poslali na <span className="break-all font-semibold">{status.email}</span>. Faktury bude možné vystavovat až po potvrzení.</span>
        </p>
        <button className="min-h-9 shrink-0 rounded-lg border border-ink/15 bg-white px-3 font-semibold hover:border-ink/40 disabled:opacity-60" disabled={pending}>
          {pending ? "Odesílám…" : "Poslat znovu"}
        </button>
        {state.ok && <p className="w-full text-ok" role="status">Nový odkaz jsme odeslali. Pokud ho nenajdete, podívejte se i do složky Spam nebo Hromadné.</p>}
        {state.error && <p className="w-full text-warn" role="alert">{state.error}</p>}
      </form>
    </div>
  );
}
