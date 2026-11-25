"use client";

import { useState } from "react";
import { strToU8, zipSync } from "fflate";
import { accountingExport } from "./actions";

/** Stáhne ZIP pro účetní: PDF (vytvoří se v prohlížeči) + ISDOC XML + přehled CSV. */
export function ExportClient({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [pdf, setPdf] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setProgress("Načítám doklady…");
    try {
      const res = await accountingExport(from, to);
      if (!res.ok) { setProgress(null); setError(res.error); return; }
      const files: Record<string, Uint8Array> = {};
      files["prehled.csv"] = strToU8(res.csv);
      const { documentPdfBlob } = await import("@/lib/documents/pdf");
      let i = 0;
      for (const it of res.items) {
        i++;
        files[`isdoc/${it.file}.isdoc`] = strToU8(it.isdoc);
        if (pdf) {
          setProgress(`Vytvářím PDF ${i} z ${res.items.length}…`);
          files[`pdf/${it.file}.pdf`] = new Uint8Array(await (await documentPdfBlob(it.view)).arrayBuffer());
        }
      }
      setProgress("Balím ZIP…");
      const zip = zipSync(files, { level: 6 });
      const url = URL.createObjectURL(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `doklady_${from}_${to}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const n = res.items.length;
      setProgress(`Hotovo – ${n} ${n === 1 ? "doklad" : n < 5 ? "doklady" : "dokladů"}.`);
    } catch {
      setProgress(null);
      setError("Export se nepodařilo dokončit. Zkuste to znovu nebo zvolte kratší období.");
    }
  }

  const busy = !!progress && !progress.startsWith("Hotovo");
  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div>
          <label className="label" htmlFor="from">Vystavené od</label>
          <input className="field num" id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="to">do</label>
          <input className="field num" id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" className="size-5 accent-accent" checked={pdf} onChange={(e) => setPdf(e.target.checked)} />
        Přiložit i PDF dokladů (u mnoha dokladů trvá déle)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={run} disabled={busy}>{busy ? "Připravuji…" : "Stáhnout ZIP"}</button>
        {progress && <span className="text-[14px] text-muted" role="status">{progress}</span>}
        {error && <span className="text-[14px] font-medium text-warn" role="alert">{error}</span>}
      </div>
    </div>
  );
}
