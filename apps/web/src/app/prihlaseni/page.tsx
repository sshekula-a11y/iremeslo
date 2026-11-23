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
  const confirmed = sp.potvrzeno === "1";

  return (
    <main className="min-h-dvh bg-paper px-5 py-8">
      <div className="mx-auto max-w-md">
        <Link href="/" className="inline-block">
          <Logo variant="full" height={44} priority />
        </Link>
        <div className="mt-8">
          <AuthForm initialMode={mode} next={next} linkFailed={failed} confirmed={confirmed} />
        </div>
      </div>
    </main>
  );
}
