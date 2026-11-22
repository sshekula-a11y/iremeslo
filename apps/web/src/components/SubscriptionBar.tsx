import { addDays } from "@/lib/calendar";
import { formatDate } from "@/lib/format";

export interface SubscriptionInfo {
  plan_id: string;
  status: string;
  period_end: string | null;
  ok: boolean;
  grace_days: number;
}

const CONTACT = "info@iremeslo.cz";

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Pruh nahoře v aplikaci: kolik zbývá ze zkušebního období, nebo že skončilo a aplikace je jen pro čtení. */
export function SubscriptionBar({ sub, today }: { sub: SubscriptionInfo | null; today: string }) {
  if (!sub) return null;
  const mail = (
    <a className="font-semibold underline" href={`mailto:${CONTACT}?subject=${encodeURIComponent("Předplatné iRemeslo.cz")}`}>{CONTACT}</a>
  );

  if (!sub.ok) {
    return (
      <div className="bg-warn text-white" role="alert">
        <p className="mx-auto max-w-6xl px-4 py-2.5 text-[14px]">
          <strong>{sub.status === "trialing" ? "Zkušební období skončilo." : "Předplatné skončilo."}</strong>{" "}
          Svá data vidíte, ale nové zakázky a doklady vytvoříte až s předplatným. Napište nám na {mail}.
        </p>
      </div>
    );
  }
  if (!sub.period_end) return null;

  if (sub.status === "trialing") {
    const left = daysBetween(today, sub.period_end); // v den registrace 30, v poslední den 0
    const soon = left <= 7;
    return (
      <div className={soon ? "bg-accent-soft" : "bg-paper"}>
        <p className="mx-auto max-w-6xl px-4 py-2 text-[13px]">
          Zkušební období do <strong>{formatDate(sub.period_end)}</strong>
          {" "}({left <= 0 ? "dnes je poslední den" : left === 1 ? "zbývá 1 den" : left < 5 ? `zbývají ${left} dny` : `zbývá ${left} dní`}).
          {soon && <> Pro další používání nám napište na {mail}.</>}
        </p>
      </div>
    );
  }
  if (sub.period_end < today) {
    const deadline = addDays(sub.period_end, sub.grace_days);
    return (
      <div className="bg-accent-soft" role="status">
        <p className="mx-auto max-w-6xl px-4 py-2 text-[13px]">
          Předplatné skončilo {formatDate(sub.period_end)}. Zaplaťte prosím do <strong>{formatDate(deadline)}</strong>, jinak se aplikace přepne jen na čtení. Dotazy: {mail}.
        </p>
      </div>
    );
  }
  return null;
}
