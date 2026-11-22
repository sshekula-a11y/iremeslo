"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { RegistrationDone } from "./RegistrationDone";

export function AuthForm({ initialMode, next, linkFailed }: { initialMode: "login" | "register"; next: string; linkFailed?: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(signIn, {});
  const [regState, regAction, regPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "login" ? loginState : regState;
  const pending = mode === "login" ? loginPending : regPending;

  // Po úspěšné registraci zmizí nadpis, přepínač i formulář – zůstane jen gratulace.
  if (regState.registered) return <RegistrationDone email={regState.registered} />;

  return (
    <>
    <h1 className="mb-6 font-display text-[28px] font-extrabold text-ink">
      {mode === "register" ? "Vyzkoušejte iRemeslo.cz zdarma" : "Vítejte zpět"}
    </h1>
    {linkFailed && (
      <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
        Odkaz z e-mailu už neplatí. Přihlaste se, nebo se zaregistrujte znovu.
      </p>
    )}
    <div className="card p-5 sm:p-6">
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-paper p-1 text-[15px] font-semibold" role="tablist">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-10 rounded-lg transition ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}
          >
            {m === "login" ? "Přihlásit se" : "Nový účet"}
          </button>
        ))}
      </div>

      <form action={mode === "login" ? loginAction : regAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="field" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Heslo</label>
          <input
            className="field"
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
          {mode === "register" && <p className="mt-1 text-[13px] text-muted">Aspoň 8 znaků.</p>}
        </div>
        {mode === "register" && (
          <label className="flex items-start gap-2.5 text-[14px] text-muted">
            <input type="checkbox" name="terms" className="mt-0.5 size-5 accent-accent" required />
            <span>Souhlasím s obchodními podmínkami a zpracováním osobních údajů.</span>
          </label>
        )}

        {state.error && <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn" role="alert">{state.error}</p>}
        {state.info && <p className="rounded-xl bg-ok-soft px-3 py-2.5 text-[14px] text-ok" role="status">{state.info}</p>}

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Moment…" : mode === "login" ? "Přihlásit se" : "Vytvořit účet zdarma"}
        </button>
      </form>
    </div>
    </>
  );
}
