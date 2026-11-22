"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueDdpp, markPaid } from "../actions";

const METHODS = [["bank", "Převodem"], ["cash", "Hotově"], ["card", "Kartou"], ["other", "Jinak"]] as const;

export function MarkPaidForm({ documentId, today, amount, ddppHint }: { documentId: string; today: string; amount: string; ddppHint: boolean }) {
  const router = useRouter();
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState("bank");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="paid-on">Zaplaceno dne</label>
          <input id="paid-on" type="date" className="field w-44" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="paid-how">Jak</label>
          <select id="paid-how" className="field w-36" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <button type="button" className="btn-dark" disabled={pending} onClick={() => {
          setError(null);
          start(async () => {
            const res = await markPaid(documentId, paidOn, method);
            if (!res.ok) setError(res.error);
            router.refresh();
          });
        }}>
          {pending ? "Ukládám…" : `Zaplaceno ${amount}`}
        </button>
      </div>
      {ddppHint && <p className="text-[13px] text-muted">Po označení se automaticky vystaví daňový doklad k přijaté platbě.</p>}
      {error && <p className="text-[13px] font-medium text-warn" role="alert">{error}</p>}
    </div>
  );
}

export function IssueDdppButton({ advanceId }: { advanceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn-dark" disabled={pending} onClick={() => {
        setError(null);
        start(async () => {
          const res = await issueDdpp(advanceId);
          if (!res.ok) return setError(res.error);
          router.push(`/app/doklady/${res.id}`);
        });
      }}>
        {pending ? "Vystavuji…" : "Vystavit daňový doklad k platbě"}
      </button>
      {error && <p className="text-[13px] font-medium text-warn" role="alert">{error}</p>}
    </div>
  );
}
