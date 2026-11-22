"use client";

import { useState } from "react";
import type { DocumentView } from "@/lib/documents/view";

/** Vytvoří PDF v prohlížeči a stáhne ho (na telefonu se otevře v prohlížeči PDF). */
export function PdfDownload({ view, fileName }: { view: DocumentView; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const { documentPdfBlob } = await import("@/lib/documents/pdf");
      const blob = await documentPdfBlob(view);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("PDF se nepodařilo vytvořit. Zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn-primary" onClick={download} disabled={busy}>
        {busy ? "Vytvářím PDF…" : "Stáhnout PDF"}
      </button>
      {error && <span className="text-[13px] font-medium text-warn" role="alert">{error}</span>}
    </div>
  );
}
