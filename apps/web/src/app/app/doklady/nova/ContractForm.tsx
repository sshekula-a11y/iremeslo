"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCzk, type Party, type VatMode, type VatRate } from "@iremeslo/core";
import { DocumentPaper } from "@/components/DocumentPaper";
import { buildContract, contractView, ContractError } from "@/lib/documents/contract";
import type { DocumentMeta } from "@/lib/documents/view";
import { parseInput } from "@/lib/money";
import { createContract, type ContractForm as Form } from "../actions";

/**
 * Smlouva o dílo: předmět, cena, termíny a podmínky; vpravo (na telefonu pod tím) živý náhled.
 * Po vystavení vznikne smlouva SOD a k ní automaticky předávací protokol PP.
 */
export function ContractForm({ jobId, initial, supplier, customer, vatPayer, vatMode, vatRate, meta, children }: {
  jobId: string; initial: Form; supplier: Party; customer: Party; vatPayer: boolean; vatMode: VatMode; vatRate: VatRate;
  meta: DocumentMeta; children?: React.ReactNode;
}) {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const digits = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value.replace(/\D/g, "").slice(0, 3) }));

  // Živý náhled: stejné funkce jako PDF. Chyba ve formuláři náhled nezastaví – ukáže se pod tlačítkem.
  let preview = null;
  let problem: string | null = null;
  try {
    const snap = buildContract({
      input: {
        title: f.title || "Předmět smlouvy",
        subject: f.subject.trim().length >= 10 ? f.subject : f.subject || "Popis díla…",
        priceNet: parseInput(f.price) || 1,
        dateFrom: f.dateFrom || null,
        dateTo: f.dateTo || null,
        siteAddress: f.siteAddress || null,
        advancePct: Number(f.advancePct || "0"),
        paymentTermsDays: Number(f.paymentTermsDays || "0"),
        warrantyMonths: Number(f.warrantyMonths || "0"),
        notes: f.notes,
      },
      supplier, customer, vatPayer, vatMode, vatRate,
    });
    preview = contractView(snap, meta);
  } catch (e) {
    problem = e instanceof ContractError ? e.message : null;
  }

  const net = parseInput(f.price);
  const payer = vatPayer && vatMode === "standard";
  const gross = payer ? net + Math.round((net * vatRate) / 100) : net;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createContract(jobId, f);
          if (!res.ok) return setError(res.error);
          router.push(`/app/doklady/${res.id}`);
        });
      }}>
        <section className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Předmět a cena</h2>
          <div>
            <label className="label" htmlFor="title">Předmět smlouvy</label>
            <input className="field" id="title" value={f.title} onChange={set("title")} required maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="subject">Popis díla</label>
            <textarea className="field min-h-36" id="subject" value={f.subject} onChange={set("subject")} required maxLength={5000} />
            <p className="mt-1 text-[13px] text-muted">Předvyplnili jsme práce a materiál ze zakázky. Upravte podle potřeby.</p>
          </div>
          <div>
            <label className="label" htmlFor="price">Cena díla {payer ? "bez DPH" : ""} (Kč)</label>
            <input className="field num" id="price" inputMode="decimal" value={f.price} required
              onChange={(e) => setF((v) => ({ ...v, price: e.target.value.replace(/[^\d,.\s]/g, "") }))} />
            {net > 0 && (
              <p className="num mt-1 text-[13px] text-muted">
                {payer ? <>DPH {vatRate} % {formatCzk(gross - net)} · celkem s DPH <strong className="text-ink">{formatCzk(gross)}</strong></>
                  : vatMode === "reverse_charge" ? "Přenesená daňová povinnost – DPH odvede objednatel." : "Nejste plátce DPH – cena je konečná."}
              </p>
            )}
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Termín a místo</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="dateFrom">Zahájení</label>
              <input className="field num" id="dateFrom" type="date" value={f.dateFrom} onChange={set("dateFrom")} />
            </div>
            <div>
              <label className="label" htmlFor="dateTo">Dokončení</label>
              <input className="field num" id="dateTo" type="date" value={f.dateTo} min={f.dateFrom || undefined} onChange={set("dateTo")} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="siteAddress">Místo provedení díla</label>
            <input className="field" id="siteAddress" value={f.siteAddress} onChange={set("siteAddress")} maxLength={300} />
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Platby a záruka</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="advancePct">Záloha (%)</label>
              <input className="field num" id="advancePct" inputMode="numeric" value={f.advancePct} onChange={digits("advancePct")} />
            </div>
            <div>
              <label className="label" htmlFor="paymentTermsDays">Splatnost (dní)</label>
              <input className="field num" id="paymentTermsDays" inputMode="numeric" value={f.paymentTermsDays} onChange={digits("paymentTermsDays")} required />
            </div>
            <div>
              <label className="label" htmlFor="warrantyMonths">Záruka (měs.)</label>
              <input className="field num" id="warrantyMonths" inputMode="numeric" value={f.warrantyMonths} onChange={digits("warrantyMonths")} required />
            </div>
          </div>
          <p className="text-[13px] text-muted">Záloha 0 % = bez zálohy. Záruka na stavební práce bývá 24–60 měsíců.</p>
          <div>
            <label className="label" htmlFor="notes">Další ujednání (nepovinné)</label>
            <textarea className="field min-h-20" id="notes" value={f.notes} onChange={set("notes")} maxLength={3000}
              placeholder="např. Objednatel zajistí přívod vody a elektřiny." />
          </div>
        </section>

        {children}

        <div className="card space-y-3 p-4">
          <p className="text-[13px] text-muted">
            Po vystavení dostane smlouva číslo a nepůjde změnit. Zároveň vytvoříme předávací protokol, který při předání díla
            vyplníte a podepíšete s objednatelem.
          </p>
          <button className="btn-primary w-full sm:w-auto" disabled={pending}>{pending ? "Vystavuji…" : "Vystavit smlouvu a předávací protokol"}</button>
          {(error || problem) && <p className="text-[13px] font-medium text-warn" role="alert">{error ?? problem}</p>}
        </div>
      </form>

      <div className="space-y-2 lg:sticky lg:top-4">
        <p className="text-[13px] font-semibold text-muted">Náhled smlouvy</p>
        {preview ? <DocumentPaper v={preview} /> : <p className="card p-4 text-[14px] text-muted">Doplňte údaje a uvidíte náhled.</p>}
      </div>
    </div>
  );
}
