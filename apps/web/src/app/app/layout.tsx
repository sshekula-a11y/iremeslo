import Link from "next/link";
import { Logo } from "@/components/Logo";
import { requireCompany } from "@/lib/data";
import { signOut } from "@/app/prihlaseni/actions";
import { NavLinks } from "./NavLinks";
import { createClient } from "@/lib/supabase/server";
import { todayInPrague } from "@/lib/calendar";
import { SubscriptionBar, type SubscriptionInfo } from "@/components/SubscriptionBar";
import { KeyboardWatcher } from "@/components/KeyboardWatcher";
import { EmailBar, type EmailStatus } from "@/components/EmailBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const company = await requireCompany();
  const isWorker = company.role === "worker";
  const supabase = await createClient();
  const [{ data: sub }, { data: emailStatus }] = await Promise.all([
    isWorker ? Promise.resolve({ data: null }) : supabase.rpc("my_subscription", { p_company: company.id }),
    supabase.rpc("my_email_status"),
  ]);

  return (
    <div className="min-h-dvh pb-16 sm:pb-0 kb:pb-0">
      <KeyboardWatcher />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={isWorker ? "/app/moje-zakazky" : "/app"} aria-label="Přehled">
            <Logo height={28} priority />
          </Link>
          <div className="hidden flex-1 sm:block">
            <NavLinks worker={isWorker} variant="top" />
          </div>
          <div className="flex items-center gap-3">
            {!isWorker && (
              <Link href="/app/nastaveni" className="max-w-48 truncate rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-paper hover:text-ink" title="Nastavení firmy">
                <span className="md:hidden">Nastavení</span>
                <span className="hidden md:inline">{company.name}</span>
              </Link>
            )}
            <form action={signOut}>
              <button className="rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-paper hover:text-ink">Odhlásit</button>
            </form>
          </div>
        </div>
      </header>
      <EmailBar status={(emailStatus as EmailStatus | null) ?? null} />
      {!isWorker && <SubscriptionBar sub={(sub as SubscriptionInfo | null) ?? null} today={todayInPrague()} />}
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden kb:hidden" aria-label="Hlavní menu">
        <NavLinks worker={isWorker} variant="bottom" />
      </nav>
    </div>
  );
}
