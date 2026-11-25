"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Party, VatRate } from "@iremeslo/core";
import { DocumentPaper } from "@/components/DocumentPaper";
import { parseInput } from "@/lib/money";
import { buildListina, listinaView, ListinaError, REMEDIES, type ListinaContext, type ListinaInput } from "@/lib/documents/extra";
import type { DocumentMeta } from "@/lib/documents/view";
import { createListina } from "../actions";

type ClientOpt = Party & { id: string };

export function ListinaForm({ ctx, ids, meta, today, initial, clients }: {
  ctx: ListinaContext; ids: { jobId: string | null; docId: string | null }; meta: DocumentMeta; today: string;
  initial: Record<string, string>; clients: ClientOpt[];
}) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.type === "checkbox" ? String((e.target as HTMLInputElement).checked) : e.target.value }));

  const input = (): ListinaInput => {
    switch (ctx.type) {
      case "delivery": return { type: "delivery", title: f.title ?? "", showPrices: f.showPrices === "true", note: f.note ?? "" };
      case "cash_in": case "cash_out": return {
        type: ctx.type, amount: parseInput(f.amount ?? ""), purpose: f.purpose ?? "", relatedNumber: f.relatedNumber || null,
        vatRate: f.vatRate ? (Number(f.vatRate) as VatRate) : null,
        counterparty: { name: f.cpName ?? "", ico: f.cpIco || null, street: f.cpStreet || null, city: f.cpCity || null, zip: f.cpZip || null },
      };
      case "reminder": return { type: "reminder", level: f.level === "final" ? "final" : "reminder", newDueDate: f.newDueDate ?? "", note: f.note ?? "" };
      case "claim": return { type: "claim", subject: f.subject ?? "", defect: f.defect ?? "", claimedOn: f.claimedOn ?? today, requestedRemedy: f.remedy ?? "", consumer: f.consumer === "true" };
      case "amendment": return { type: "amendment", scope: f.scope ?? "", priceNet: f.price ? parseInput(f.price) : null, dateFrom: f.dateFrom || null, dateTo: f.dateTo || null, reason: f.reason ?? "" };
    }
  };

  let preview = null, problem: string | null = null;
  try { preview = listinaView(buildListina(ctx, input(), today), meta); }
  catch (e) { problem = e instanceof ListinaError ? e.message : "Doplňte údaje."; }

  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={k}>{label}</label><input className="field" id={k} value={f[k] ?? ""} onChange={set(k)} {...props} /></div>
  );
  const area = (k: string, label: string, rows = 3, placeholder = "") => (
    <div><label className="label" htmlFor={k}>{label}</label><textarea className="field" id={k} rows={rows} value={f[k] ?? ""} onChange={set(k)} placeholder={placeholder} /></div>
  );
  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    if (c) setF((v) => ({ ...v, cpName: c.name, cpIco: c.ico ?? "", cpStreet: c.street ?? "", cpCity: c.city ?? "", cpZip: c.zip ?? "" }));
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault(); setError(null);
        start(async () => {
          const res = await createListina(ctx.type, ids, input());
          if (!res.ok) return setError(res.error);
          router.push(`/app/doklady/${res.id}`);
        });
      }}>
        <section className="card space-y-3 p-4">
          {ctx.type === "delivery" && <>
            {field("title", "Nadpis", { maxLength: 200 })}
            <p className="text-[13px] text-muted">Položky ({ctx.job?.lines.length ?? 0}) bereme ze zakázky {ctx.job?.number}. Změníte je v zakázce.</p>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="size-5 accent-accent" checked={f.showPrices === "true"} onChange={set("showPrices")} /> Uvést i ceny</label>
            {area("note", "Poznámka (nepovinné)", 2)}
          </>}

          {(ctx.type === "cash_in" || ctx.type === "cash_out") && <>
            {clients.length > 0 && (
              <div><label className="label" htmlFor="cp-pick">{ctx.type === "cash_in" ? "Od koho (zákazník)" : "Komu (ze seznamu)"}</label>
                <select id="cp-pick" className="field" defaultValue="" onChange={(e) => pickClient(e.target.value)}>
                  <option value="">— vyplnit ručně —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
            )}
            {field("cpName", ctx.type === "cash_in" ? "Přijato od (jméno / firma)" : "Vyplaceno komu (jméno / firma)", { maxLength: 200 })}
            <div className="grid grid-cols-[1fr_7rem] gap-2">{field("cpStreet", "Ulice")}{field("cpIco", "IČO", { inputMode: "numeric", maxLength: 8 })}</div>
            <div className="grid grid-cols-[1fr_7rem] gap-2">{field("cpCity", "Obec")}{field("cpZip", "PSČ")}</div>
            {field("amount", "Částka (Kč)", { inputMode: "decimal", required: true })}
            {field("purpose", "Účel platby", { maxLength: 300, placeholder: ctx.type === "cash_in" ? "např. Úhrada faktury 2026001" : "např. Nákup materiálu – barvy" })}
            {field("relatedNumber", "K dokladu (nepovinné)", { maxLength: 40 })}
            {ctx.vatPayer && (
              <div><label className="label" htmlFor="vatRate">Rozpis DPH</label>
                <select id="vatRate" className="field" value={f.vatRate ?? ""} onChange={set("vatRate")}>
                  <option value="">bez rozpisu DPH</option><option value="21">21 %</option><option value="12">12 %</option>
                </select></div>
            )}
          </>}

          {ctx.type === "reminder" && <>
            <p className="text-[14px]">Faktura <strong>{ctx.invoice?.number}</strong>, dlužná částka <strong className="num">{((ctx.invoice?.amountDue ?? 0) / 100).toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} Kč</strong></p>
            <div><label className="label" htmlFor="level">Druh</label>
              <select id="level" className="field" value={f.level ?? "reminder"} onChange={set("level")}>
                <option value="reminder">Upomínka</option><option value="final">Předžalobní výzva (§ 142a o. s. ř.)</option>
              </select></div>
            {field("newDueDate", "Nová lhůta k úhradě", { type: "date", min: today })}
            {f.level === "final" && <p className="text-[13px] text-muted">Předžalobní výzvu pošlete aspoň 7 dní před podáním žaloby doporučeně, do datové schránky nebo e-mailem. Bez ní soud nemusí přiznat náhradu nákladů řízení.</p>}
            {area("note", "Poznámka (nepovinné)", 2)}
          </>}

          {ctx.type === "claim" && <>
            {field("subject", "Čeho se reklamace týká", { maxLength: 300 })}
            {area("defect", "Popis vady", 4, "Co nefunguje, kde, od kdy…")}
            {field("claimedOn", "Reklamace uplatněna dne", { type: "date", max: today })}
            <div><label className="label" htmlFor="remedy">Požadované vyřízení</label>
              <select id="remedy" className="field" value={f.remedy ?? REMEDIES[0]} onChange={set("remedy")}>
                {REMEDIES.map((r) => <option key={r}>{r}</option>)}
              </select></div>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="size-5 accent-accent" checked={f.consumer === "true"} onChange={set("consumer")} /> Reklamuje spotřebitel (lhůta 30 dní)</label>
          </>}

          {ctx.type === "amendment" && <>
            <p className="text-[14px]">Dodatek č. <strong>{ctx.contract?.nextNo}</strong> ke smlouvě <strong>{ctx.contract?.number}</strong></p>
            {area("scope", "Změna předmětu / rozsahu díla (nepovinné)", 3, "např. Navíc nátěr okapů a svodů.")}
            {field("price", `Nová cena díla ${ctx.vatPayer && ctx.vatMode === "standard" ? "bez DPH " : ""}(Kč, nepovinné)`, { inputMode: "decimal" })}
            <div className="grid grid-cols-2 gap-2">{field("dateFrom", "Nové zahájení", { type: "date" })}{field("dateTo", "Nové dokončení", { type: "date" })}</div>
            {field("reason", "Důvod změny (nepovinné)", { maxLength: 1000 })}
          </>}
        </section>

        <div className="card space-y-2 p-4">
          <p className="text-[13px] text-muted">Po vystavení dostane listina číslo a nepůjde změnit. PDF bude s vaším logem, razítkem a podpisem.</p>
          <button className="btn-primary w-full sm:w-auto" disabled={pending || !!problem}>{pending ? "Vystavuji…" : "Vystavit"}</button>
          {(error || problem) && <p className="text-[13px] font-medium text-warn" role="alert">{error ?? problem}</p>}
        </div>
      </form>
      <div className="space-y-2 lg:sticky lg:top-4">
        <p className="text-[13px] font-semibold text-muted">Náhled</p>
        {preview ? <DocumentPaper v={preview} /> : <p className="card p-4 text-[14px] text-muted">Doplňte údaje a uvidíte náhled.</p>}
      </div>
    </div>
  );
}
