"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ initialMode, next, linkFailed, confirmed }: { initialMode: "login" | "register"; next: string; linkFailed?: boolean; confirmed?: boolean }) {
  const [mode, setMode] = useState(initialMode);
  // E-mail zůstane vyplněný i po chybě a po přepnutí na registraci.
  const [email, setEmail] = useState("");
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(signIn, {});
  const [regState, regAction, regPending] = useActionState<AuthState, FormData>(signUp, {});
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const state = mode === "login" ? loginState : regState;
  const pending = mode === "login" ? loginPending : regPending;

  // E-mail bez účtu: z přihlášení rovnou přepneme na registraci (e-mail i heslo zůstanou vyplněné).
  const [switchedFrom, setSwitchedFrom] = useState<AuthState | null>(null);
  if (loginState.noAccount && switchedFrom !== loginState) {
    setSwitchedFrom(loginState);
    setMode("register");
  }
  const autoSwitched = mode === "register" && switchedFrom !== null && !regState.error;

  return (
    <>
    <h1 className="mb-6 font-display text-[28px] font-extrabold text-ink">
      {mode === "register" ? "Vyzkoušejte iRemeslo.cz 30 dní zdarma" : "Vítejte zpět"}
    </h1>
    {confirmed && (
      <p className="mb-4 rounded-xl bg-ok-soft px-3 py-2.5 text-[14px] text-ok" role="status">
        E-mail je potvrzený. Přihlaste se a pokračujte zadáním IČO.
      </p>
    )}
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
          <input className="field" id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Heslo</label>
          <div className="relative">
            <input
              className="field pr-12"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
              aria-pressed={showPassword}
              aria-controls="password"
              title={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted hover:text-ink"
            >
              <EyeIcon crossed={showPassword} />
            </button>
          </div>
          {mode === "register" && <p className="mt-1 text-[13px] text-muted">Alespoň 8 znaků.</p>}
        </div>
        {mode === "register" && (
          <label className="flex items-start gap-2.5 text-[14px] text-muted">
            <input type="checkbox" name="terms" className="mt-0.5 size-5 accent-accent" required />
            <span>Souhlasím s <a href="/obchodni-podminky" target="_blank" rel="noreferrer" className="font-semibold text-accent-ink underline">obchodními podmínkami</a> včetně omezení odpovědnosti (čl. 8) a beru na vědomí <a href="/ochrana-osobnich-udaju" target="_blank" rel="noreferrer" className="font-semibold text-accent-ink underline">zásady ochrany osobních údajů</a>.</span>
          </label>
        )}

        {autoSwitched && (
          <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-[14px]" role="status">
            E-mail <strong>{email}</strong> u nás zatím nemá účet. Zaškrtněte souhlas s podmínkami a účet vytvoříte během několika sekund.
          </p>
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

/** Oko (zobrazit heslo) / přeškrtnuté oko (skrýt heslo). */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3 3l18 18" />}
    </svg>
  );
}
