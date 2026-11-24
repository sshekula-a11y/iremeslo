import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteMenu } from "@/components/SiteMenu";
import { SITE_LINKS, type SiteSection } from "@/lib/site-links";

/**
 * Horní lišta veřejného webu. Na počítači odkazy v řádku, na telefonu tlačítko „Menu“;
 * „Zadat poptávku“ je vidět vždy.
 */
export function SiteHeader({ current }: { current?: SiteSection }) {
  return (
    <header data-place="hlavicka" className="relative border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:px-5 sm:py-3">
        <Link href="/" aria-label="iRemeslo.cz – úvod" className="shrink-0">
          {/* Stejné logo se sloganem jako na počítači, na telefonu jen menší. */}
          <Logo variant="full" height={44} priority className="h-6 min-[360px]:h-7 min-[390px]:h-8 sm:h-10 lg:h-11" />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <nav className="hidden items-center whitespace-nowrap text-[15px] font-semibold lg:flex" aria-label="Web">
            {SITE_LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current === l.id ? "page" : undefined}
                className={`rounded-lg px-2.5 py-2 ${current === l.id ? "text-accent-ink" : "text-ink hover:text-accent-ink"}`}>
                {l.label}
              </Link>
            ))}
            <Link href="/prihlaseni" className="rounded-lg px-2.5 py-2 text-ink hover:text-accent-ink">Přihlásit se</Link>
          </nav>
          <Link href="/poptavky/nova" className="btn-primary min-h-10 whitespace-nowrap px-2.5 text-[14px] min-[390px]:px-3 sm:px-4 sm:text-[15px]">
            Zadat poptávku
          </Link>
          <SiteMenu current={current} />
        </div>
      </div>
    </header>
  );
}
