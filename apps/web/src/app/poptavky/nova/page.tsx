import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { todayInPrague } from "@/lib/calendar";
import { InquiryForm } from "./InquiryForm";
import { CATEGORY_LABEL } from "@/lib/inquiries";

export const metadata: Metadata = {
  alternates: { canonical: "/poptavky/nova" },
  title: "Zadat poptávku zdarma",
  description: "Zadejte poptávku řemeslných prací zdarma a bez registrace. Ozvou se vám řemeslníci z iRemeslo.cz.",
};

export default async function NewInquiryPage({ searchParams }: PageProps<"/poptavky/nova">) {
  const { obor } = await searchParams;
  const category = typeof obor === "string" && CATEGORY_LABEL[obor] ? obor : "";
  return (
    <main>
      <SiteHeader current="poptavky" />
      <div className="mx-auto max-w-2xl space-y-5 px-5 py-8">
        <Link href="/poptavky" className="text-[14px] text-muted hover:text-ink">← Poptávky</Link>
        <div>
          <h1 className="font-display text-[28px] font-extrabold leading-tight sm:text-[34px]">Zadat poptávku</h1>
          <p className="mt-1 text-[16px] text-muted">Zdarma a bez registrace. Popište, co potřebujete, a řemeslníci se vám ozvou.</p>
        </div>
        <InquiryForm today={todayInPrague()} defaultCategory={category} />
      </div>
      <SiteFooter />
    </main>
  );
}
