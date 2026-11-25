"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";

export interface MenuLink { href: string; label: string; hint?: string }

/** Rozbalovací nabídka akcí (tlačítko „Další ▾“ apod.). Zavře se klikem vedle, klávesou Esc nebo výběrem. */
export function ActionMenu({ label, items, primary = false, align = "right" }: { label: string; items: MenuLink[]; primary?: boolean; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`${primary ? "btn-primary" : "btn-ghost"} inline-flex items-center gap-1.5`}>
        {label} <Icon name="chevron" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="menu" className={`absolute z-30 mt-1 w-72 rounded-xl border border-line bg-white p-1 shadow-[0_12px_32px_rgba(5,38,76,0.16)] ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((i) => (
            <li key={i.href} role="none">
              <Link role="menuitem" href={i.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 hover:bg-paper">
                <span className="block text-[15px] font-semibold">{i.label}</span>
                {i.hint && <span className="block text-[13px] text-muted">{i.hint}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
