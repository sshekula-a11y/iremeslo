"use client";

import { startTransition, useActionState } from "react";
import type { AdminState } from "./actions";

/** Formulář administrace: po odeslání ukáže chybu nebo potvrzení; políčka se při chybě nemažou. */
export function ActionForm({ action, submit, tone = "dark", children, className = "" }: {
  action: (s: AdminState, f: FormData) => Promise<AdminState>;
  submit: string;
  tone?: "dark" | "primary" | "danger" | "ghost";
  children?: React.ReactNode;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  const btn = tone === "primary" ? "btn-primary" : tone === "ghost" ? "btn-ghost" : tone === "danger" ? "btn bg-warn text-white hover:bg-[#8f1c13]" : "btn-dark";
  return (
    <form className={`space-y-2 ${className}`} onSubmit={(e) => {
      // React po akci formulář vynuluje; při chybě to nechceme – odešleme ručně.
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(() => run(data));
    }}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button className={`${btn} min-h-10`} disabled={pending}>{pending ? "Ukládám…" : submit}</button>
        {state.error && <p className="text-[13px] font-medium text-warn" role="alert">{state.error}</p>}
        {state.ok && !pending && <p className="text-[13px] font-medium text-ok" role="status">{state.message ?? "Uloženo"}</p>}
      </div>
    </form>
  );
}
