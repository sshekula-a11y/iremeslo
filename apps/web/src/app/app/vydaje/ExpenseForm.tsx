"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EXPENSE_CATEGORIES, PAID_METHODS } from "@/lib/expenses";
import { deleteExpense, discardUpload, readReceipt, saveExpense, type ExpenseFields } from "./actions";

export interface JobOption { id: string; label: string }

/** Fotka z telefonu → JPEG s delší stranou nejvýš 2000 px (účtenka zůstane čitelná, soubor malý). PDF beze změny. */
async function prepareFile(file: File): Promise<{ blob: Blob; ext: "jpg" | "pdf" }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return { blob: file, ext: "pdf" };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bitmap.width * scale));
  c.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("obrázek");
  return { blob, ext: "jpg" };
}

const EMPTY: ExpenseFields = {
  kind: "receipt", supplierName: "", supplierIco: "", docNumber: "", issueDate: "", total: "", vatBase: "", vat: "",
  currency: "CZK", category: "material", description: "", paidMethod: "card", jobId: "",
};

export function ExpenseForm({ companyId, expenseId, initial, hasFile, jobs, ai, today, vatPayer }: {
  companyId: string; expenseId: string | null; initial: ExpenseFields | null; hasFile: boolean; jobs: JobOption[];
  ai: { enabled: boolean; used: number; limit: number }; today: string; vatPayer: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<ExpenseFields>(initial ?? { ...EMPTY, issueDate: today });
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; pdf: boolean } | null>(null);
  const [phase, setPhase] = useState<"idle" | "upload" | "reading">("idle");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState(false);
  const [used, setUsed] = useState(ai.used);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const saved = useRef(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const set = <K extends keyof ExpenseFields>(k: K, v: ExpenseFields[K]) => setF((p) => ({ ...p, [k]: v }));
  const canAi = ai.enabled && used < ai.limit;

  async function pick(file: File) {
    setError(null); setAiNote(null); setAiFilled(false);
    if (file.size > 25 * 1024 * 1024) { setError("Soubor je příliš velký."); return; }
    setPhase("upload");
    try {
      const prepared = await prepareFile(file);
      if (prepared.blob.size > 10 * 1024 * 1024) { setError("PDF je příliš velké (nejvýš 10 MB)."); setPhase("idle"); return; }
      const p = `${companyId}/expenses/${crypto.randomUUID()}.${prepared.ext}`;
      const { error: upErr } = await createClient().storage.from("files").upload(p, prepared.blob, { contentType: prepared.ext === "pdf" ? "application/pdf" : "image/jpeg", upsert: false });
      if (upErr) { setError("Soubor se nepodařilo nahrát."); setPhase("idle"); return; }
      if (path) void discardUpload(path);
      setPath(p);
      setPreview({ url: URL.createObjectURL(prepared.blob), pdf: prepared.ext === "pdf" });
      if (!canAi) { setPhase("idle"); return; }
      setPhase("reading");
      const r = await readReceipt(p);
      setPhase("idle");
      if (!r.ok) { setError(r.error); return; }
      setUsed((u) => u + 1);
      setF((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(r.fields)) if (v !== undefined && v !== "") (next as Record<string, string>)[k] = v as string;
        return next;
      });
      setAiFilled(true);
      setAiNote(r.readable ? r.note || null : "Doklad se nepodařilo spolehlivě přečíst – údaje prosím doplňte nebo opravte.");
    } catch {
      setPhase("idle");
      setError("Soubor se nepodařilo zpracovat. Zkuste jinou fotku nebo PDF.");
    }
  }

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await saveExpense(expenseId, f, path, aiFilled ? "ai" : "manual");
      if (!r.ok) { setError(r.error); return; }
      saved.current = true;
      router.push("/app/vydaje");
      router.refresh();
    });
  };
  const cancel = () => { if (path && !saved.current) void discardUpload(path); router.push("/app/vydaje"); };
  const remove = () => {
    if (!expenseId || !confirm("Opravdu smazat tento výdaj i s účtenkou?")) return;
    start(async () => {
      const r = await deleteExpense(expenseId);
      if (!r.ok) { setError(r.error ?? "Výdaj se nepodařilo smazat."); return; }
      router.push("/app/vydaje");
      router.refresh();
    });
  };

  const busy = phase !== "idle";
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4" aria-labelledby="uctenka">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="uctenka" className="font-semibold">Účtenka nebo faktura</h2>
            <p className="text-[14px] text-muted">
              {ai.enabled
                ? canAi ? "Vyfoťte účtenku nebo nahrajte PDF faktury – AI účetní údaje přečte a vyplní. Vy je jen zkontrolujete." : `Limit čtení účtenek na tento měsíc je vyčerpaný (${used} z ${ai.limit}). Soubor uložíme, údaje doplňte ručně.`
                : "Vyfoťte účtenku nebo nahrajte PDF – uložíme ji k výdaji. Čtení údajů pomocí AI zatím není zapnuté."}
            </p>
          </div>
          {ai.enabled && <span className="num rounded-full bg-paper px-2.5 py-1 text-[12px] text-muted ring-1 ring-line">AI tento měsíc: {used} / {ai.limit}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => input.current?.click()}>
            {phase === "upload" ? "Nahrávám…" : phase === "reading" ? "AI čte účtenku…" : path || hasFile ? "Nahrát jinou" : "Vyfotit nebo nahrát účtenku"}
          </button>
          <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void pick(file); }} />
          {phase === "reading" && <span className="text-[14px] text-muted" role="status">Obvykle to trvá 5–15 sekund.</span>}
          {hasFile && !path && <span className="text-[14px] text-muted">Účtenka je uložená u výdaje.</span>}
        </div>
        {preview && (
          preview.pdf
            ? <p className="text-[14px]">📄 PDF nahráno.</p>
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={preview.url} alt="Nahraná účtenka" className="max-h-64 rounded-[10px] ring-1 ring-line" />
        )}
        {aiFilled && (
          <p role="status" className="rounded-[10px] bg-ok-soft px-3 py-2 text-[14px] text-ok">
            Údaje vyplnila AI účetní – před uložením je zkontrolujte.{aiNote ? ` ${aiNote}` : ""}
          </p>
        )}
        {!aiFilled && aiNote && <p role="status" className="rounded-[10px] bg-warn-soft px-3 py-2 text-[14px] text-warn">{aiNote}</p>}
      </section>

      <section className="card grid gap-3 p-4 sm:grid-cols-2" aria-label="Údaje výdaje">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="e-supplier">Dodavatel</label>
          <input id="e-supplier" className="field" value={f.supplierName} onChange={(e) => set("supplierName", e.target.value)} maxLength={200} placeholder="Např. Hornbach, Shell, Bauhaus" />
        </div>
        <div>
          <label className="label" htmlFor="e-ico">IČO dodavatele</label>
          <input id="e-ico" className="field num" inputMode="numeric" value={f.supplierIco} onChange={(e) => set("supplierIco", e.target.value.replace(/\D/g, "").slice(0, 8))} />
        </div>
        <div>
          <label className="label" htmlFor="e-doc">Číslo dokladu</label>
          <input id="e-doc" className="field num" value={f.docNumber} onChange={(e) => set("docNumber", e.target.value)} maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="e-date">Datum</label>
          <input id="e-date" type="date" className="field" max={today} value={f.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="e-kind">Druh dokladu</label>
          <select id="e-kind" className="field" value={f.kind} onChange={(e) => set("kind", e.target.value as ExpenseFields["kind"])}>
            <option value="receipt">Účtenka</option>
            <option value="invoice">Přijatá faktura</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="e-total">Celkem zaplaceno ({f.currency})</label>
          <input id="e-total" className="field num" inputMode="decimal" value={f.total} onChange={(e) => set("total", e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className="label" htmlFor="e-paid">Zaplaceno</label>
          <select id="e-paid" className="field" value={f.paidMethod} onChange={(e) => set("paidMethod", e.target.value)}>
            {PAID_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {vatPayer && <>
          <div>
            <label className="label" htmlFor="e-base">Základ DPH</label>
            <input id="e-base" className="field num" inputMode="decimal" value={f.vatBase} onChange={(e) => set("vatBase", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="e-vat">DPH</label>
            <input id="e-vat" className="field num" inputMode="decimal" value={f.vat} onChange={(e) => set("vat", e.target.value)} />
          </div>
        </>}
        <div>
          <label className="label" htmlFor="e-cat">Kategorie</label>
          <select id="e-cat" className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {EXPENSE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="e-job">K zakázce (nepovinné)</label>
          <select id="e-job" className="field" value={f.jobId} onChange={(e) => set("jobId", e.target.value)}>
            <option value="">— bez zakázky —</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="e-desc">Co jste koupili</label>
          <input id="e-desc" className="field" value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={500} placeholder="Např. fasádní barva 2× 15 l" />
        </div>
      </section>

      {error && <p role="alert" className="rounded-[10px] bg-warn-soft px-3 py-2 text-[14px] text-warn">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" className="btn-primary" disabled={pending || busy} onClick={submit}>{pending ? "Ukládám…" : "Uložit výdaj"}</button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={cancel}>Zrušit</button>
        </div>
        {expenseId && <button type="button" className="text-[14px] font-semibold text-warn hover:underline" disabled={pending} onClick={remove}>Smazat výdaj</button>}
      </div>
    </div>
  );
}
