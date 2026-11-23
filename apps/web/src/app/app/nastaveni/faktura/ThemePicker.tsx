"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceSnapshot } from "@iremeslo/core";
import { THEMES } from "@/lib/documents/themes";
import { invoiceView, type DocumentMeta } from "@/lib/documents/view";
import { DocumentPaper } from "@/components/DocumentPaper";
import { saveInvoiceTheme } from "../actions";

/** Výběr barvy s okamžitým náhledem; barva se uloží hned po kliknutí. */
export function ThemePicker({ snapshot, meta, initialTheme, canEdit, children }: {
  snapshot: InvoiceSnapshot; meta: Omit<DocumentMeta, "theme">; initialTheme: string; canEdit: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function choose(key: string) {
    if (!canEdit || key === theme) return;
    const previous = theme;
    setTheme(key);
    setStatus(null);
    start(async () => {
      const res = await saveInvoiceTheme(key);
      if (res.error) {
        setTheme(previous);
        setStatus({ ok: false, text: res.error });
      } else {
        setStatus({ ok: true, text: "Uloženo" });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr] lg:items-start">
      <div className="space-y-5">
        <section className="card p-4" aria-labelledby="barva">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="barva" className="font-display text-[17px] font-bold">Barva</h2>
            {pending ? <span className="text-[13px] text-muted">Ukládám…</span>
              : status && <span className={`text-[13px] font-medium ${status.ok ? "text-ok" : "text-warn"}`} role="status">{status.text}</span>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="barva">
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} type="button" role="radio" aria-checked={theme === key} disabled={!canEdit} onClick={() => choose(key)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left disabled:cursor-not-allowed ${theme === key ? "border-ink ring-2 ring-ink/15" : "border-line hover:border-ink/30"}`}>
                <span className="size-6 shrink-0 rounded-full" style={{ background: t.accent }} aria-hidden="true" />
                <span className="text-[14px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </section>
        {children}
      </div>

      <section aria-label="Náhled faktury" className="lg:sticky lg:top-4">
        <p className="mb-2 text-[13px] text-muted">Náhled s vymyšleným odběratelem a položkou. Takhle bude vypadat vaše faktura.</p>
        <DocumentPaper v={invoiceView(snapshot, { ...meta, theme })} />
      </section>
    </div>
  );
}
