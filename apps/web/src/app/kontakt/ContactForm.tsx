"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { sendContact, type ContactState } from "./actions";

const TOPICS = [
  ["remeslnik", "Jsem řemeslník – aplikace a funkce"],
  ["predplatne", "Předplatné a fakturace"],
  ["zakaznik", "Jsem zákazník – moje poptávka"],
  ["jine", "Něco jiného"],
] as const;

export function ContactForm({ defaultTopic }: { defaultTopic: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, {});
  const [started] = useState(() => Date.now());
  const v = state.values ?? {};

  if (state.ok) {
    return (
      <div className="rounded-2xl bg-ok-soft p-5 text-ok" role="status">
        <p className="font-display text-[20px] font-extrabold">Děkujeme, zprávu jsme přijali.</p>
        <p className="mt-1 text-[15px]">Odpovíme na váš e-mail, obvykle do jednoho pracovního dne.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="t" value={started} />
      {/* Pole pro roboty – člověk ho nevidí ani nevyplní */}
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="c-web">Web</label>
        <input id="c-web" name="web" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-name">Jméno a příjmení</label>
          <input id="c-name" name="name" className="field" autoComplete="name" required maxLength={100} defaultValue={v.name} />
        </div>
        <div>
          <label className="label" htmlFor="c-email">E-mail pro odpověď</label>
          <input id="c-email" name="email" type="email" inputMode="email" className="field" autoComplete="email" required maxLength={254} defaultValue={v.email} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-topic">S čím potřebujete pomoct</label>
        <select id="c-topic" name="topic" className="field" defaultValue={v.topic ?? defaultTopic}>
          {TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="c-msg">Zpráva</label>
        <textarea id="c-msg" name="message" className="field min-h-36" required maxLength={4000} defaultValue={v.message}
          placeholder="Napište, s čím vám můžeme pomoct. U poptávky uveďte prosím její název nebo e-mail, ze kterého jste ji zadali." />
      </div>
      <label className="flex items-start gap-2 text-[14px] text-muted">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-accent" />
        <span>Souhlasím se zpracováním jména a e-mailu kvůli odpovědi na zprávu. Více v <Link href="/ochrana-osobnich-udaju" className="underline">zásadách ochrany osobních údajů</Link>.</span>
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">{state.error}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>{pending ? "Odesílám…" : "Odeslat zprávu"}</button>
    </form>
  );
}
