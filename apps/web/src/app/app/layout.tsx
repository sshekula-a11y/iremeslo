import Link from "next/link";
import { Logo } from "@/components/Logo";
import { requireCompany } from "@/lib/data";
import { signOut } from "@/app/prihlaseni/actions";
import { NavLinks } from "./NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const company = await requireCompany();
  const isWorker = company.role === "worker";

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={isWorker ? "/app/moje-zakazky" : "/app"} aria-label="Přehled">
            <Logo size={26} />
          </Link>
          <div className="hidden flex-1 sm:block">
            <NavLinks worker={isWorker} variant="top" />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-[13px] text-white/60 md:inline">{company.name}</span>
            <form action={signOut}>
              <button className="rounded-lg px-2 py-1.5 text-[13px] text-white/70 hover:bg-white/10 hover:text-white">Odhlásit</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white sm:hidden" aria-label="Hlavní menu">
        <NavLinks worker={isWorker} variant="bottom" />
      </nav>
    </div>
  );
}
