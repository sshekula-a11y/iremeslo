import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { UnsubscribeForm } from "./UnsubscribeForm";

export const metadata: Metadata = { title: "Odhlásit upozornění", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function UnsubscribePage({ searchParams }: PageProps<"/upozorneni/odhlasit">) {
  const t = (await searchParams).t;
  const token = typeof t === "string" && /^[0-9a-f]{36}$/.test(t) ? t : null;
  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="card space-y-3 p-6">
          <h1 className="font-display text-[24px] font-extrabold">Upozornění na nové poptávky</h1>
          {token ? <UnsubscribeForm token={token} /> : <p className="text-muted">Odkaz je neplatný. Upozornění vypnete v aplikaci v Nastavení.</p>}
        </div>
      </div>
    </main>
  );
}
