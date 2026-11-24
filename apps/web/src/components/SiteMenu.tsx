"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SITE_LINKS, type SiteSection } from "@/lib/site-links";

/** Tlačítko „Menu“ na telefonu a rozbalený seznam odkazů pod hlavičkou. */
export function SiteMenu({ current }: { current?: SiteSection }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="site-menu"
        aria-label="Menu"
        className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-2 min-[390px]:px-2.5 text-[14px] font-semibold text-ink hover:bg-paper lg:hidden">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        <span className="hidden min-[390px]:inline">Menu</span>
      </button>
      {open && (
        <nav id="site-menu" aria-label="Menu" className="absolute inset-x-0 top-full z-40 border-b border-line bg-white shadow-lg lg:hidden">
          <ul className="mx-auto max-w-5xl px-4 py-2">
            {SITE_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} aria-current={current === l.id ? "page" : undefined}
                  className={`flex min-h-12 items-center border-b border-line text-[17px] font-semibold ${current === l.id ? "text-accent-ink" : "text-ink"}`}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/prihlaseni" onClick={() => setOpen(false)} className="flex min-h-12 items-center text-[17px] font-semibold text-ink">
                Přihlásit se
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}
