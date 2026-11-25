import { requireCompany } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { todayInPrague } from "@/lib/calendar";
import { SubscriptionBar, type SubscriptionInfo } from "@/components/SubscriptionBar";
import { KeyboardWatcher } from "@/components/KeyboardWatcher";
import { EmailBar, type EmailStatus } from "@/components/EmailBar";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const company = await requireCompany();
  const isWorker = company.role === "worker";
  const supabase = await createClient();
  const [{ data: sub }, { data: emailStatus }] = await Promise.all([
    isWorker ? Promise.resolve({ data: null }) : supabase.rpc("my_subscription", { p_company: company.id }),
    supabase.rpc("my_email_status"),
  ]);

  return (
    <>
      <KeyboardWatcher />
      <AppShell
        worker={isWorker}
        companyName={company.name}
        banners={<>
          <EmailBar status={(emailStatus as EmailStatus | null) ?? null} />
          {!isWorker && <SubscriptionBar sub={(sub as SubscriptionInfo | null) ?? null} today={todayInPrague()} />}
        </>}
      >
        {children}
      </AppShell>
    </>
  );
}
