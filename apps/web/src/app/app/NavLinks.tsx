"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; exact?: boolean; more?: boolean };

/** Hlavní položky jsou vždy vidět; „more“ jsou na telefonu a menším počítači pod tlačítkem Více. */
const STAFF: Item[] = [
  { href: "/app", label: "Přehled", exact: true },
  { href: "/app/zakazky", label: "Zakázky" },
  { href: "/app/kalendar", label: "Kalendář" },
  { href: "/app/faktury", label: "Faktury" },
  { href: "/app/klienti", label: "Klienti", more: true },
  { href: "/app/cenik", label: "Ceník", more: true },
  { href: "/app/zamestnanci", label: "Lidé", more: true },
  { href: "/app/nastaveni", label: "Nastavení", more: true },
];
const WORKER: Item[] = [{ href: "/app/moje-zakazky", label: "Moje zakázky" }];

export function NavLinks({ worker, variant }: { worker: boolean; variant: "top" | "bottom" }) {
  const path = usePathname();
  const items = worker ? WORKER : STAFF;
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  const main = items.filter((i) => !i.more);
  // Nastavení je v hlavičce pod názvem firmy, v horním menu by bylo dvakrát.
  const more = items.filter((i) => i.more && (variant === "bottom" || i.href !== "/app/nastaveni"));
  const moreActive = more.some((i) => active(i.href));

  if (variant === "top") {
    const link = (i: Item, extra = "") => (
      <li key={i.href} className={extra}>
        <Link href={i.href} aria-current={active(i.href, i.exact) ? "page" : undefined}
          className={`block rounded-lg px-3 py-2 text-[14px] font-medium ${active(i.href, i.exact) ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}>
          {i.label}
        </Link>
      </li>
    );
    return (
      <ul className="flex items-center gap-1">
        {main.map((i) => link(i))}
        {more.map((i) => link(i, "hidden lg:block"))}
        {more.length > 0 && (
          <li className="lg:hidden">
            <MoreMenu items={more} active={active} highlighted={moreActive} placement="down" />
          </li>
        )}
      </ul>
    );
  }

  const cols = main.length + (more.length ? 1 : 0);
  return (
    <ul className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {main.map((i) => (
        <li key={i.href}>
          <Link href={i.href} aria-current={active(i.href, i.exact) ? "page" : undefined}
            className={`flex min-h-14 items-center justify-center text-[13px] font-semibold ${active(i.href, i.exact) ? "text-accent-ink" : "text-muted"}`}>
            {i.label}
          </Link>
        </li>
      ))}
      {more.length > 0 && (
        <li>
          <MoreMenu items={more} active={active} highlighted={moreActive} placement="up" />
        </li>
      )}
    </ul>
  );
}

function MoreMenu({ items, active, highlighted, placement }: {
  items: Item[]; active: (href: string, exact?: boolean) => boolean; highlighted: boolean; placement: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const bottom = placement === "up";
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}
        className={bottom
          ? `flex min-h-14 w-full items-center justify-center text-[13px] font-semibold ${highlighted || open ? "text-accent-ink" : "text-muted"}`
          : `rounded-lg px-3 py-2 text-[14px] font-medium ${highlighted ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}>
        Více
      </button>
      {open && (
        <ul className={`absolute z-30 min-w-44 rounded-xl border border-line bg-white p-1 shadow-[0_12px_32px_rgba(5,38,76,0.14)] ${bottom ? "bottom-full right-2 mb-2" : "right-0 top-full mt-1"}`}>
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-[15px] font-medium ${active(i.href) ? "bg-accent-soft text-ink" : "text-ink hover:bg-paper"}`}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
