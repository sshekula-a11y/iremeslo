import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Horní lišta veřejného webu (úvod, Jak to funguje). */
export function SiteHeader({ current }: { current?: "jak-to-funguje" }) {
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
        <Link href="/" aria-label="iRemeslo.cz – úvod" className="shrink-0">
          <span className="hidden sm:inline"><Logo variant="full" height={44} priority /></span>
          <span className="min-[420px]:hidden"><Logo variant="mark" height={34} priority /></span>
          <span className="hidden min-[420px]:inline sm:hidden"><Logo height={28} priority /></span>
        </Link>
        <nav className="flex items-center gap-0.5 whitespace-nowrap text-[15px] font-semibold" aria-label="Web">
          <Link href="/jak-to-funguje" aria-current={current === "jak-to-funguje" ? "page" : undefined}
            className={`rounded-lg px-2.5 py-2 ${current === "jak-to-funguje" ? "text-accent-ink" : "text-ink hover:text-accent-ink"}`}>
            Jak to funguje
          </Link>
          <Link href="/prihlaseni" className="rounded-lg px-2.5 py-2 text-ink hover:text-accent-ink">Přihlásit se</Link>
        </nav>
      </div>
    </div>
  );
}
