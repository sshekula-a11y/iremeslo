"use client";

import Link from "next/link";

/** Chyba při zobrazení stránky. Server ji zaznamenal (instrumentation.ts); uživateli nabídneme zkusit znovu. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="font-display text-[28px] font-extrabold">Něco se pokazilo</h1>
      <p className="mt-2 text-[16px] text-muted">Chybu jsme zaznamenali a podíváme se na ni. Zkuste to prosím znovu.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-primary" onClick={() => reset()}>Zkusit znovu</button>
        <Link href="/" className="btn-ghost">Na úvod</Link>
      </div>
      <p className="mt-6 text-[14px] text-muted">Opakuje se to? <Link href="/kontakt" className="font-semibold text-accent-ink underline">Napište nám</Link>.</p>
    </main>
  );
}
