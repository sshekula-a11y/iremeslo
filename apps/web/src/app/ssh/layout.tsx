import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: { default: "Administrace", template: "%s · Administrace iRemeslo" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 md:grid-cols-[auto_1fr_auto]">
          <p className="whitespace-nowrap font-display text-[17px] font-extrabold">iRemeslo <span className="font-bold text-accent">· admin</span></p>
          <nav className="col-span-2 -mx-1 min-w-0 overflow-x-auto md:col-span-1 md:row-start-1 md:col-start-2" aria-label="Administrace">
            <AdminNav />
          </nav>
          <div className="flex items-center gap-3 text-[13px] text-white/70 md:col-start-3 md:row-start-1">
            <span className="hidden lg:inline">{user.email}</span>
            <Link href="/app" className="whitespace-nowrap rounded-lg px-2 py-1.5 hover:bg-white/10 hover:text-white">Do aplikace</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
