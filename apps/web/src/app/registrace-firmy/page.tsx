import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/data";
import { CompanyForm } from "./CompanyForm";

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
        <h1 className="font-display text-[26px] font-extrabold">Vaše firma</h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">Zadejte IČO a údaje doplníme z ARES. Bez IČO vyplňte jméno a adresu ručně.</p>
        <CompanyForm />
      </div>
    </main>
  );
}
