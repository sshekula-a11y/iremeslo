import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Poptávka odeslána", robots: { index: false, follow: false } };

export default async function InquirySentPage({ searchParams }: PageProps<"/poptavky/odeslano">) {
  const { e } = await searchParams;
  const email = typeof e === "string" ? e.slice(0, 254) : "";
  return (
    <main>
      <SiteHeader current="poptavky" />
      <div className="mx-auto max-w-md px-5 py-12">
        <section className="card p-6 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-[24px]" aria-hidden="true">✉</span>
          <h1 className="font-display text-[24px] font-extrabold">Zkontrolujte svůj e-mail</h1>
          <p className="mt-2 text-[15px] text-muted">
            {email ? <>Na <strong className="break-all text-ink">{email}</strong> jsme</> : "Na váš e-mail jsme"} poslali odkaz.
            Poptávku zveřejníme, jakmile na něj kliknete.
          </p>
          <p className="mt-3 text-[14px] text-muted">E-mail nevidíte? Podívejte se i do složky Spam nebo Hromadné. Odkaz platí 3 dny.</p>
          <Link href="/poptavky" className="btn-ghost mt-6">Prohlédnout poptávky</Link>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
