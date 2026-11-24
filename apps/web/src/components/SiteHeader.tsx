import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Horní lišta veřejného webu (úvod, poptávky, Jak to funguje). */
export function SiteHeader({ current }: { current?: "jak-to-funguje" | "poptavky" }) {
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
        <Link href="/" aria-label="iRemeslo.cz – úvod" className="shrink-0">
          {/* Stejné logo se sloganem jako na počítači, na telefonu jen menší. */}
          <Logo variant="full" height={44} priority className="h-7 min-[360px]:h-8 min-[390px]:h-9 sm:h-11" />
        </Link>
        <nav className="flex items-center whitespace-nowrap text-[14px] font-semibold sm:gap-0.5 sm:text-[15px]" aria-label="Web">
          <Link href="/poptavky" aria-current={current === "poptavky" ? "page" : undefined}
            className={`rounded-lg px-2 py-2 sm:px-2.5 ${current === "poptavky" ? "text-accent-ink" : "text-ink hover:text-accent-ink"}`}>
            Poptávky
          </Link>
          <Link href="/jak-to-funguje" aria-current={current === "jak-to-funguje" ? "page" : undefined}
            className={`hidden rounded-lg px-2 py-2 sm:px-2.5 sm:block ${current === "jak-to-funguje" ? "text-accent-ink" : "text-ink hover:text-accent-ink"}`}>
            Jak to funguje
          </Link>
          <Link href="/prihlaseni" className="rounded-lg px-2 py-2 sm:px-2.5 text-ink hover:text-accent-ink">Přihlásit se</Link>
        </nav>
      </div>
    </div>
  );
}
