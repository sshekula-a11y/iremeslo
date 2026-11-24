import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { todayInPrague } from "@/lib/calendar";
import { InquiryForm } from "./InquiryForm";

export const metadata: Metadata = {
  title: "Zadat poptávku zdarma",
  description: "Zadejte poptávku řemeslných prací zdarma a bez registrace. Ozvou se vám řemeslníci z iRemeslo.cz.",
};

export default function NewInquiryPage() {
  return (
    <main>
      <SiteHeader current="poptavky" />
      <div className="mx-auto max-w-2xl space-y-5 px-5 py-8">
        <Link href="/poptavky" className="text-[14px] text-muted hover:text-ink">← Poptávky</Link>
        <div>
          <h1 className="font-display text-[28px] font-extrabold leading-tight sm:text-[34px]">Zadat poptávku</h1>
          <p className="mt-1 text-[16px] text-muted">Zdarma a bez registrace. Popište, co potřebujete, a řemeslníci se vám ozvou.</p>
        </div>
        <InquiryForm today={todayInPrague()} />
      </div>
      <SiteFooter />
    </main>
  );
}
