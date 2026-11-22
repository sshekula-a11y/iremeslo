"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; exact?: boolean };

const STAFF: Item[] = [
  { href: "/app", label: "Přehled", exact: true },
  { href: "/app/zakazky", label: "Zakázky" },
  { href: "/app/kalendar", label: "Kalendář" },
  { href: "/app/klienti", label: "Klienti" },
  { href: "/app/cenik", label: "Ceník" },
  { href: "/app/zamestnanci", label: "Lidé" },
];
const WORKER: Item[] = [{ href: "/app/moje-zakazky", label: "Moje zakázky" }];

export function NavLinks({ worker, variant }: { worker: boolean; variant: "top" | "bottom" }) {
  const path = usePathname();
  const items = worker ? WORKER : STAFF;
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));

  if (variant === "top") {
    return (
      <ul className="flex gap-1">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className={`rounded-lg px-3 py-2 text-[14px] font-medium ${active(i.href, i.exact) ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            className={`flex min-h-14 items-center justify-center text-[13px] font-semibold ${active(i.href, i.exact) ? "text-accent-ink" : "text-muted"}`}
          >
            {i.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
