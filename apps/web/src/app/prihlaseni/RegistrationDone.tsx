"use client";

import { useActionState, useEffect, useRef } from "react";
import { SignupSteps } from "@/components/SignupSteps";
import { resendConfirmation, type ResendState } from "./actions";

/** Po registraci: jen gratulace a další kroky, formulář zmizí. */
export function RegistrationDone({ email }: { email: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, resend, pending] = useActionState<ResendState, FormData>(resendConfirmation, {});

  // Obrazovka se celá vymění – přesuneme pohled i čtečku obrazovky na nadpis.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, []);

  return (
    <section className="card overflow-hidden" aria-labelledby="hotovo">
      <div className="bg-ink px-5 pb-6 pt-7 text-white sm:px-7">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-[24px] font-bold text-ink" aria-hidden="true">✓</span>
        <h1 id="hotovo" ref={heading} tabIndex={-1} className="font-display text-[26px] font-extrabold leading-tight outline-none sm:text-[30px]">
          Gratulujeme! Zaregistrovali jste si účet na platformě iRemeslo.cz
        </h1>
        <p className="mt-2 text-[16px] text-white/75">Zbývá ještě pár kroků a můžete vystavit první nabídku.</p>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        <SignupSteps current={0} email={email} />

        <div className="rounded-xl bg-paper p-4 text-[14px]">
          <p className="font-semibold">E-mail nepřišel?</p>
          <p className="mt-1 text-muted">Počkejte pár minut a podívejte se i do složky Hromadné nebo Spam. Když odkaz vyprší, pošlete si nový.</p>
          <form action={resend} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="email" value={email} />
            <button className="btn-ghost min-h-10" disabled={pending || state.ok}>
              {pending ? "Posílám…" : state.ok ? "Posláno znovu" : "Poslat e-mail znovu"}
            </button>
            {state.ok && <span className="text-ok" role="status">Nový odkaz je na cestě.</span>}
            {state.error && <span className="text-warn" role="alert">{state.error}</span>}
          </form>
        </div>

        <p className="text-[14px] text-muted">
          Překlep v e-mailu? {/* Obyčejný odkaz: stránka se načte znovu a formulář bude prázdný. */}
          <a href="/prihlaseni?rezim=registrace" className="font-semibold text-accent-ink underline">Zaregistrujte se znovu</a>.
        </p>
      </div>
    </section>
  );
}
