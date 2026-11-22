import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Přihlášení" };

export default async function LoginPage({ searchParams }: PageProps<"/prihlaseni">) {
  const sp = await searchParams;
  const mode = sp.rezim === "registrace" ? "register" : "login";
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/app";
  const failed = sp.chyba === "odkaz";

  return (
    <main className="min-h-dvh bg-ink px-5 py-8">
      <div className="mx-auto max-w-md">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mb-6 mt-8 font-display text-[28px] font-extrabold text-white">
          {mode === "register" ? "Vyzkoušejte iŘemeslo zdarma" : "Vítejte zpět"}
        </h1>
        {failed && (
          <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
            Odkaz z e-mailu už neplatí. Přihlaste se, nebo se zaregistrujte znovu.
          </p>
        )}
        <AuthForm initialMode={mode} next={next} />
      </div>
    </main>
  );
}
