"use client";

import { useState } from "react";
import { unzipSync } from "fflate";
import type { ParsedInvoice } from "@/lib/documents/pdf-import";
import { parseInvoiceFile, saveImportedInvoice } from "./actions";

type Row = { file: File; inv: ParsedInvoice; duplicate: boolean; include: boolean; status?: "ok" | "error"; message?: string };
type Failed = { name: string; error: string };

const OK_EXT = /\.(pdf|isdoc|xml)$/i;

/** Rozbalí i ZIP v ZIPu (tak exportuje třeba FakturaOnline). */
function expand(name: string, bytes: Uint8Array): File[] {
  if (/\.zip$/i.test(name)) {
    return Object.entries(unzipSync(bytes))
      .filter(([p, b]) => !p.endsWith("/") && !p.startsWith("__MACOSX") && b.length)
      .flatMap(([p, b]) => expand(p.split("/").pop() ?? p, b));
  }
  if (!OK_EXT.test(name)) return [];
  return [new File([bytes.slice().buffer as ArrayBuffer], name, { type: /\.pdf$/i.test(name) ? "application/pdf" : "application/xml" })];
}

export function ImportInvoices({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const busy = !!progress;

  async function pick(list: FileList | null) {
    setDone(null); setRows([]); setFailed([]);
    if (!list?.length) return;
    const files: File[] = [];
    for (const f of Array.from(list)) {
      try { files.push(...expand(f.name, new Uint8Array(await f.arrayBuffer()))); }
      catch { setFailed((x) => [...x, { name: f.name, error: "Soubor se nepodařilo rozbalit." }]); }
    }
    if (!files.length) { setFailed((x) => [...x, { name: "—", error: "Nenašli jsme žádné PDF ani ISDOC." }]); return; }
    // ISDOC má přednost; PDF se stejným názvem se k němu jen připojí
    const isdocNames = new Set(files.filter((f) => !/\.pdf$/i.test(f.name)).map((f) => f.name.replace(/\.\w+$/, "")));
    const next: Row[] = [];
    let i = 0;
    for (const file of files) {
      i++;
      if (/\.pdf$/i.test(file.name) && isdocNames.has(file.name.replace(/\.\w+$/, ""))) continue;
      setProgress(`Čtu ${i} z ${files.length}: ${file.name}`);
      const fd = new FormData(); fd.append("file", file);
      try {
        const res = await parseInvoiceFile(fd);
        if (res.ok) next.push({ file, inv: res.invoice, duplicate: res.duplicate, include: !res.duplicate });
        else setFailed((x) => [...x, { name: file.name, error: res.error }]);
      } catch { setFailed((x) => [...x, { name: file.name, error: "Soubor se nepodařilo přečíst." }]); }
    }
    next.sort((a, b) => a.inv.issueDate.localeCompare(b.inv.issueDate) || a.inv.number.localeCompare(b.inv.number));
    setRows(next);
    setProgress(null);
  }

  const edit = (i: number, patch: Partial<ParsedInvoice>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, inv: { ...x.inv, ...patch } } : x)));
  const chosen = rows.filter((r) => r.include && r.status !== "ok");

  async function save() {
    let ok = 0, err = 0, clients = 0, n = 0;
    for (const [i, r] of rows.entries()) {
      if (!r.include || r.status === "ok") continue;
      n++;
      setProgress(`Ukládám ${n} z ${chosen.length}…`);
      const fd = new FormData();
      fd.append("data", JSON.stringify(r.inv));
      if (/\.pdf$/i.test(r.file.name)) fd.append("file", r.file);
      const res = await saveImportedInvoice(fd).catch(() => ({ ok: false as const, error: "Spojení selhalo." }));
      setRows((list) => list.map((x, j) => (j === i ? { ...x, status: res.ok ? "ok" : "error", message: res.ok ? undefined : res.error } : x)));
      if (res.ok) { ok++; if (res.clientCreated) clients++; } else err++;
    }
    setProgress(null);
    setDone(`Uloženo ${ok} faktur${clients ? `, nově založeno ${clients} zákazníků` : ""}${err ? `, ${err} se nepodařilo uložit` : ""}.`);
  }

  const total = chosen.reduce((s, r) => s + (Number(r.inv.total) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4 sm:p-5">
        <p className="text-[14px] text-muted">
          Nahrajte faktury z dosavadního programu: PDF, ISDOC (.isdoc/.xml) nebo ZIP s nimi (i ZIP v ZIPu).
          Údaje přečteme z dokumentu a před uložením je můžete opravit.
        </p>
        {canWrite ? (
          <input type="file" multiple accept=".pdf,.isdoc,.xml,.zip" disabled={busy} onChange={(e) => { void pick(e.target.files); e.target.value = ""; }}
            className="block w-full text-[14px] file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:py-2.5 file:font-semibold file:text-white" />
        ) : <p className="text-[14px] text-warn">Účet je jen pro čtení – import není možný.</p>}
        {progress && <p className="text-[14px] text-muted" role="status">{progress}</p>}
        {failed.length > 0 && (
          <ul className="text-[13px] text-warn">{failed.map((f, i) => <li key={i}>{f.name}: {f.error}</li>)}</ul>
        )}
      </div>

      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-[13px]">
              <thead className="bg-paper text-left text-muted">
                <tr>
                  <th className="px-2 py-2"><span className="sr-only">Uložit</span></th>
                  <th className="px-2 py-2">Číslo</th><th className="px-2 py-2">Druh</th><th className="px-2 py-2">Vystaveno</th>
                  <th className="px-2 py-2">Splatnost</th><th className="px-2 py-2">Odběratel</th><th className="px-2 py-2">IČO</th>
                  <th className="px-2 py-2 text-right">Částka (Kč)</th><th className="px-2 py-2">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => {
                  const locked = r.status === "ok" || busy;
                  const inp = "w-full rounded-lg border border-line bg-white px-1.5 py-1 disabled:bg-transparent disabled:border-transparent";
                  return (
                    <tr key={i} className={r.duplicate && !r.include ? "opacity-60" : ""}>
                      <td className="px-2 py-1"><input type="checkbox" className="size-4 accent-accent" checked={r.include} disabled={locked}
                        onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} aria-label={`Uložit ${r.inv.number}`} /></td>
                      <td className="px-2 py-1"><input className={`${inp} num w-28`} value={r.inv.number} disabled={locked} onChange={(e) => edit(i, { number: e.target.value })} /></td>
                      <td className="px-2 py-1">
                        <select className={inp} value={r.inv.kind} disabled={locked} onChange={(e) => edit(i, { kind: e.target.value as ParsedInvoice["kind"] })}>
                          <option value="invoice">Faktura</option><option value="advance">Zálohová</option>
                        </select>
                      </td>
                      <td className="px-2 py-1"><input type="date" className={`${inp} num`} value={r.inv.issueDate} disabled={locked} onChange={(e) => edit(i, { issueDate: e.target.value })} /></td>
                      <td className="px-2 py-1"><input type="date" className={`${inp} num`} value={r.inv.dueDate} disabled={locked} onChange={(e) => edit(i, { dueDate: e.target.value })} /></td>
                      <td className="px-2 py-1"><input className={`${inp} min-w-48`} value={r.inv.customerName} disabled={locked} onChange={(e) => edit(i, { customerName: e.target.value })} /></td>
                      <td className="px-2 py-1"><input className={`${inp} num w-24`} value={r.inv.customerIco} disabled={locked} onChange={(e) => edit(i, { customerIco: e.target.value })} /></td>
                      <td className="px-2 py-1"><input className={`${inp} num w-28 text-right`} value={r.inv.total} disabled={locked} onChange={(e) => edit(i, { total: e.target.value.replace(",", ".") })} /></td>
                      <td className="whitespace-nowrap px-2 py-1">
                        {r.status === "ok" ? <span className="text-ok">Uloženo</span>
                          : r.status === "error" ? <span className="text-warn">{r.message}</span>
                          : r.duplicate ? <span className="text-muted">Už je uložená</span> : <span className="text-muted">{r.inv.source || "Nová"}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
            <p className="num text-[14px] text-muted">Vybráno {chosen.length} faktur · celkem {total.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} Kč</p>
            <button type="button" className="btn-primary" disabled={busy || chosen.length === 0} onClick={save}>{busy ? "Ukládám…" : `Uložit ${chosen.length} faktur`}</button>
          </div>
        </div>
      )}
      {done && <p className="rounded-xl bg-ok-soft px-3 py-2 text-[14px] text-ok" role="status">{done}</p>}
    </div>
  );
}
