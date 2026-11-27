"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/ssh", label: "Přehled", exact: true },
  { href: "/ssh/firmy", label: "Firmy" },
  { href: "/ssh/uzivatele", label: "Uživatelé" },
  { href: "/ssh/platby", label: "Platby" },
  { href: "/ssh/poptavky", label: "Poptávky" },
  { href: "/ssh/profese", label: "Profese" },
  { href: "/ssh/emaily", label: "E-maily" },
  { href: "/ssh/zpravy", label: "Zprávy" },
  { href: "/ssh/ai", label: "AI" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <ul className="flex gap-1">
      {ITEMS.map((i) => {
        const on = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <li key={i.href}>
            <Link href={i.href} aria-current={on ? "page" : undefined}
              className={`block whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium ${on ? "bg-white/15 text-white" : "text-white/70 hover:text-white"}`}>
              {i.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
