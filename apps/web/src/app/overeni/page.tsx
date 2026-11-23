import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Potvrzení e-mailu", robots: { index: false, follow: false } };

/** Sem vede odkaz z potvrzovacího e-mailu (iremeslo.cz/overeni?t=…). Funguje i bez přihlášení. */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/overeni">) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_email", { p_token: token });
  const result = (error ? { ok: false, reason: "error" } : data ?? { ok: false, reason: "invalid" }) as { ok: boolean; reason?: string };
  const { data: auth } = await supabase.auth.getUser();
  const loggedIn = !!auth.user;

  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white px-5 py-3">
        <div className="mx-auto max-w-md">
          <Link href="/" aria-label="iRemeslo.cz"><Logo variant="full" height={40} priority /></Link>
        </div>
      </header>
      <div className="mx-auto max-w-md px-5 py-10">
        {result.ok ? (
          <section className="card p-6 text-center">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-ok-soft text-[24px] font-bold text-ok" aria-hidden="true">✓</span>
            <h1 className="font-display text-[24px] font-extrabold">E-mail je potvrzený</h1>
            <p className="mt-2 text-[15px] text-muted">Děkujeme. Teď můžete vystavovat faktury.</p>
            <Link href={loggedIn ? "/app" : "/prihlaseni?next=/app"} className="btn-primary mt-6 w-full">
              {loggedIn ? "Pokračovat do aplikace" : "Přihlásit se"}
            </Link>
          </section>
        ) : (
          <section className="card p-6">
            <h1 className="font-display text-[24px] font-extrabold">
              {result.reason === "expired" ? "Odkaz už vypršel" : "Odkaz nefunguje"}
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              {result.reason === "expired"
                ? "Odkaz je platný 48 hodin. Nový si po přihlášení pošlete tlačítkem „Poslat znovu“ v horní části aplikace."
                : "Odkaz je neúplný nebo již neplatí. Zkopírujte ho z e-mailu celý, nebo si po přihlášení pošlete nový."}
            </p>
            <Link href={loggedIn ? "/app" : "/prihlaseni?next=/app"} className="btn-primary mt-6 w-full">
              {loggedIn ? "Do aplikace" : "Přihlásit se"}
            </Link>
            <p className="mt-4 text-[13px] text-muted">Potřebujete pomoc? Napište nám na <a className="font-semibold text-accent-ink underline" href="mailto:info@iremeslo.cz">info@iremeslo.cz</a>.</p>
          </section>
        )}
      </div>
    </main>
  );
}
