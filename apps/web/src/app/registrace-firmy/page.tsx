import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/data";
import { CompanyForm } from "./CompanyForm";
import { SIGNUP_STEP_COUNT } from "@/components/SignupSteps";

export const metadata: Metadata = { title: "Registrace firmy" };

export default async function RegisterCompanyPage() {
  await requireUser();
  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white px-5 py-3">
        <div className="mx-auto max-w-md">
          <Logo variant="full" height={40} priority />
        </div>
      </header>
      <div className="mx-auto max-w-md px-5 py-8">
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
          <span className="font-semibold text-ok">✓ E-mail je potvrzený</span>
          <span className="num text-muted">Krok 2 z {SIGNUP_STEP_COUNT}</span>
        </p>
        <h1 className="font-display text-[26px] font-extrabold">Zadejte IČO</h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">Název, adresu i DIČ vaší firmy načteme z ARES. Když ARES zrovna neodpovídá, vyplňte údaje ručně.</p>
        <CompanyForm />
      </div>
    </main>
  );
}
