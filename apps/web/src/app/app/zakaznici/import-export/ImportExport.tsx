"use client";

import { useState } from "react";
import { strToU8, zipSync } from "fflate";
import { buildVcf, buildXlsx, parseContactFile, TABLE_HEADER, tableRow, type ContactRow, type ParsedFile } from "@/lib/contacts-io";
import { exportClients, importClients, type ImportResult } from "../actions";

function download(data: Uint8Array | string, name: string, type: string) {
  const blob = new Blob([typeof data === "string" ? data : (data.buffer as ArrayBuffer)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function ImportExport({ canWrite }: { canWrite: boolean }) {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const rows: ContactRow[] = files.flatMap((f) => f.rows);
  const day = new Date().toISOString().slice(0, 10);

  async function exportAs(kind: "vcf" | "xlsx" | "zip") {
    setBusy("Připravuji export…");
    try {
      const list = await exportClients();
      if (!list.length) { setBusy("Zatím nemáte žádné zákazníky."); return; }
      const vcf = buildVcf(list);
      const xlsx = buildXlsx([TABLE_HEADER, ...list.map(tableRow)]);
      if (kind === "vcf") download(vcf, `zakaznici_${day}.vcf`, "text/vcard");
      else if (kind === "xlsx") download(xlsx, `zakaznici_${day}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      else download(zipSync({ "zakaznici.vcf": strToU8(vcf), "zakaznici.xlsx": xlsx }), `zakaznici_${day}.zip`, "application/zip");
      setBusy(`Staženo ${list.length} zákazníků.`);
    } catch {
      setBusy("Export se nepodařil. Zkuste to znovu.");
    }
  }

  async function pick(list: FileList | null) {
    setResult(null);
    if (!list?.length) return;
    const parsed: ParsedFile[] = [];
    for (const f of Array.from(list)) {
      if (f.size > 20 * 1024 * 1024) { parsed.push({ file: f.name, rows: [], error: "Soubor je větší než 20 MB." }); continue; }
      parsed.push(...parseContactFile(f.name, new Uint8Array(await f.arrayBuffer())));
    }
    setFiles(parsed);
  }

  async function save() {
    setBusy("Ukládám…");
    const res = await importClients(rows);
    setResult(res);
    setBusy(null);
    if (res.ok) setFiles([]);
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="export">
        <h2 id="export" className="font-display text-[19px] font-bold">Export zákazníků</h2>
        <p className="text-[14px] text-muted">vCard otevře telefon, Google i Outlook; Excel se hodí pro tabulky a účetní programy.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => exportAs("vcf")}>vCard (.vcf)</button>
          <button type="button" className="btn-ghost" onClick={() => exportAs("xlsx")}>Excel (.xlsx)</button>
          <button type="button" className="btn-dark" onClick={() => exportAs("zip")}>ZIP (obojí)</button>
        </div>
        {busy && !busy.startsWith("Ukládám") && <p className="text-[14px] text-muted" role="status">{busy}</p>}
      </section>

      <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="import">
        <h2 id="import" className="font-display text-[19px] font-bold">Import zákazníků</h2>
        <p className="text-[14px] text-muted">
          Nahrajte vCard (.vcf) z telefonu nebo Google kontaktů, tabulku Excel (.xlsx) nebo CSV, případně ZIP s více soubory.
          V tabulce musí být v prvním řádku názvy sloupců (např. Jméno, IČO, Telefon, E-mail, Ulice, Obec, PSČ).
        </p>
        {canWrite ? (
          <input type="file" multiple accept=".vcf,.vcard,.xlsx,.csv,.txt,.zip" onChange={(e) => { void pick(e.target.files); e.target.value = ""; }}
            className="block w-full text-[14px] file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:py-2.5 file:font-semibold file:text-white" />
        ) : <p className="text-[14px] text-warn">Účet je jen pro čtení – import není možný.</p>}

        {files.length > 0 && (
          <div className="space-y-3">
            <ul className="text-[14px]">
              {files.map((f, i) => (
                <li key={i} className={f.error ? "text-warn" : "text-muted"}>{f.file}: {f.error ?? `${f.rows.length} kontaktů`}</li>
              ))}
            </ul>
            {rows.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[40rem] text-[13px]">
                    <thead className="bg-paper text-left text-muted">
                      <tr><th className="px-2 py-1.5">Jméno / název</th><th className="px-2 py-1.5">IČO</th><th className="px-2 py-1.5">Telefon</th><th className="px-2 py-1.5">E-mail</th><th className="px-2 py-1.5">Obec</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i}><td className="px-2 py-1.5 font-semibold">{r.name}</td><td className="num px-2 py-1.5">{r.ico}</td><td className="px-2 py-1.5">{r.phone}</td><td className="px-2 py-1.5">{r.email}</td><td className="px-2 py-1.5">{r.city}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 50 && <p className="text-[13px] text-muted">… a dalších {rows.length - 50}.</p>}
                <button type="button" className="btn-primary" onClick={save} disabled={busy === "Ukládám…"}>
                  {busy === "Ukládám…" ? "Ukládám…" : `Importovat ${rows.length} kontaktů`}
                </button>
                <p className="text-[13px] text-muted">Kontakty, které už máte (stejné IČO, e-mail, telefon nebo jméno a obec), přeskočíme. Souhlas se zasíláním nabídek se nenastaví.</p>
              </>
            )}
          </div>
        )}
        {result && (result.ok
          ? <p className="rounded-xl bg-ok-soft px-3 py-2 text-[14px] text-ok" role="status">
              Uloženo {result.inserted} zákazníků{result.duplicates ? `, ${result.duplicates} už jste měli` : ""}{result.fixed ? `, u ${result.fixed} jsme vynechali neplatné IČO nebo e-mail` : ""}.
            </p>
          : <p className="rounded-xl bg-warn-soft px-3 py-2 text-[14px] text-warn" role="alert">{result.error}</p>)}
      </section>
    </div>
  );
}
