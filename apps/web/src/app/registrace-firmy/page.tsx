import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/data";
import { CompanyForm } from "./CompanyForm";
import { SIGNUP_STEP_COUNT, SignupSteps } from "@/components/SignupSteps";
import { DataLayerEvent } from "@/components/DataLayerEvent";

export const metadata: Metadata = { title: "Registrace firmy" };

export default async function RegisterCompanyPage({ searchParams }: PageProps<"/registrace-firmy">) {
  const user = await requireUser();
  const { vitejte } = await searchParams;
  const justRegistered = vitejte === "1";

  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white px-5 py-3">
        <div className="mx-auto max-w-md">
          <Logo variant="full" height={40} priority />
        </div>
      </header>
      <div className="mx-auto max-w-md space-y-6 px-5 py-8">
        {justRegistered && <DataLayerEvent name="sign_up" />}
        {justRegistered && (
          // Hned po registraci: gratulace a co ještě zbývá (formulář registrace už je pryč).
          <section className="card overflow-hidden" aria-labelledby="gratulace">
            <div className="bg-ink px-5 pb-6 pt-6 text-white">
              <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-accent text-[22px] font-bold text-ink" aria-hidden="true">✓</span>
              <h1 id="gratulace" className="font-display text-[24px] font-extrabold leading-tight">
                Gratulujeme! Zaregistrovali jste si účet na platformě iRemeslo.cz
              </h1>
              <p className="mt-2 text-[15px] text-white/75">Zbývá ještě pár kroků a můžete vystavit první nabídku.</p>
            </div>
            <div className="space-y-4 p-5">
              <p className="flex gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-[14px]">
                <span aria-hidden="true" className="text-[18px] leading-5">✉</span>
                <span>
                  Na <strong className="break-all">{user.email}</strong> jsme poslali odkaz k potvrzení e-mailu.
                  Potvrdit ho stačí před vystavením první faktury, zatím můžete pokračovat.
                </span>
              </p>
              <SignupSteps current={0} />
            </div>
          </section>
        )}

        <div>
          <p className="num mb-1 text-[14px] text-muted">Krok 1 z {SIGNUP_STEP_COUNT}</p>
          {justRegistered ? (
            <h2 className="font-display text-[22px] font-extrabold">Zadejte IČO</h2>
          ) : (
            <h1 className="font-display text-[26px] font-extrabold">Zadejte IČO</h1>
          )}
          <p className="mb-5 mt-1 text-[15px] text-muted">Název, adresu i DIČ vaší firmy načteme z ARES. Když ARES zrovna neodpovídá, vyplňte údaje ručně.</p>
          <CompanyForm />
        </div>
      </div>
    </main>
  );
}
