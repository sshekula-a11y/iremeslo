"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

/**
 * Úzká informační lišta o cookies. Používáme jen nezbytné cookies (přihlášení, vybraná firma), na které
 * se souhlas nevyžaduje (§ 89 odst. 3 zákona č. 127/2005 Sb.) – lišta proto jen informuje a má „Rozumím“.
 * Zavření se pamatuje v prohlížeči; v aplikaci a administraci se lišta neukazuje (překrývala by spodní menu).
 */
const KEY = "iremeslo-cookies-ok";
const listeners = new Set<() => void>();
let dismissedInMemory = false;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function isDismissed(): boolean {
  if (dismissedInMemory) return true;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function dismiss() {
  dismissedInMemory = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // soukromé okno apod. – stačí, že zmizí do obnovení stránky
  }
  listeners.forEach((l) => l());
}

export function CookieBar() {
  const path = usePathname();
  // Na serveru lištu nevykreslujeme (neznáme volbu návštěvníka) – objeví se až v prohlížeči.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  if (dismissed || path.startsWith("/app") || path.startsWith("/ssh")) return null;

  return (
    <div role="region" aria-label="Informace o cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-1.5 text-[13px] sm:px-5 sm:py-2">
        <p className="min-w-0 text-white/85">
          <span className="sm:hidden">Jen nezbytné cookies, žádné reklamní.</span>
          <span className="hidden sm:inline">Používáme jen nezbytné cookies pro přihlášení, žádné reklamní ani analytické.</span>{" "}
          <Link href="/ochrana-osobnich-udaju#cookies" className="whitespace-nowrap font-semibold text-white underline underline-offset-2">Více</Link>
        </p>
        <button type="button" onClick={dismiss}
          className="min-h-8 shrink-0 rounded-lg bg-white px-3 text-[13px] font-semibold text-ink hover:bg-white/90">
          Rozumím
        </button>
      </div>
    </div>
  );
}
