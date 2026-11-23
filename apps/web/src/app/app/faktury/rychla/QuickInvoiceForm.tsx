"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeInvoice, DEFAULT_UNITS, formatCzk, lineTotal, type VatRate } from "@iremeslo/core";
import { parseInput, toInput } from "@/lib/money";
import type { AresCompany } from "@/lib/types";
import { quickInvoice } from "./actions";

export interface QuickClient { id: string; name: string; ico: string | null }
export interface QuickCatalogItem { name: string; unit: string; price: string }

interface Item { key: number; description: string; qty: string; unit: string; unitPrice: string }

let seq = 1;
const emptyItem = (): Item => ({ key: seq++, description: "", qty: "1", unit: "ks", unitPrice: "" });
const clean = (s: string) => s.replace(/[^\d,.]/g, "");

export function QuickInvoiceForm({ clients, catalog, vatPayer, defaultVatRate, today }: {
  clients: QuickClient[]; catalog: QuickCatalogItem[]; vatPayer: boolean; defaultVatRate: 12 | 21; today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Odběratel
  const [clientId, setClientId] = useState(clients.length ? "" : "");
  const [client, setClient] = useState({ kind: "company" as "company" | "person", name: "", ico: "", dic: "", street: "", city: "", zip: "", email: "" });
  const [ares, setAres] = useState<{ loading: boolean; message?: string; ok?: boolean }>({ loading: false });
  const setC = (k: keyof typeof client) => (e: React.ChangeEvent<HTMLInputElement>) => setClient((c) => ({ ...c, [k]: e.target.value }));

  // Položky a DPH
  const [subject, setSubject] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [vatRate, setVatRate] = useState<12 | 21>(defaultVatRate);
  const [reverse, setReverse] = useState(false);
  const [taxableDate, setTaxableDate] = useState(today);
  const vatMode = !vatPayer ? "non_payer" : reverse ? "reverse_charge" : "standard";

  const totals = useMemo(() => {
    try {
      const lines = items
        .filter((i) => parseInput(i.qty) > 0)
        .map((i) => ({ description: i.description || "–", qty: parseInput(i.qty), unit: i.unit, unitPrice: parseInput(i.unitPrice), vatRate: (vatMode === "standard" ? vatRate : 0) as VatRate }));
      return lines.length ? computeInvoice({ mode: vatMode, lines }) : null;
    } catch {
      return null;
    }
  }, [items, vatMode, vatRate]);

  async function loadAres() {
    setAres({ loading: true });
    try {
      const res = await fetch(`/api/ares/${encodeURIComponent(client.ico.trim())}`);
      const body = (await res.json()) as AresCompany | { error: string };
      if (!res.ok || "error" in body) return setAres({ loading: false, message: "error" in body ? body.error : "Nepovedlo se načíst." });
      setClient((c) => ({ ...c, kind: "company", ico: body.ico, name: body.name, dic: body.dic ?? "", street: body.street, city: body.city, zip: body.zip }));
      setAres({ loading: false, ok: true, message: "Načteno z ARES." });
    } catch {
      setAres({ loading: false, message: "ARES teď neodpovídá. Vyplňte údaje ručně." });
    }
  }

  function updateItem(key: number, patch: Partial<Item>) {
    setItems((list) => list.map((i) => {
      if (i.key !== key) return i;
      const next = { ...i, ...patch };
      // Položka z ceníku: po napsání přesného názvu se doplní cena a jednotka.
      if (patch.description !== undefined) {
        const hit = catalog.find((c) => c.name.toLocaleLowerCase("cs") === patch.description!.trim().toLocaleLowerCase("cs"));
        if (hit) Object.assign(next, { description: hit.name, unit: hit.unit, unitPrice: toInput(parseInput(hit.price)) });
      }
      return next;
    }));
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await quickInvoice({
        clientId, client, subject: subject.trim(), taxableDate, vatMode, vatRate: vatMode === "standard" ? vatRate : 0,
        items: items.map(({ description, qty, unit, unitPrice }) => ({ description: description.trim(), qty, unit, unitPrice })),
      });
      if (!res.ok) return setError(res.error);
      router.push(`/app/doklady/${res.id}?rychla=1`);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        {/* Odběratel */}
        <section className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Komu fakturujete</h2>
          {clients.length > 0 && (
            <div>
              <label className="label" htmlFor="q-client">Odběratel</label>
              <select id="q-client" className="field" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">+ Nový odběratel</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.ico ? ` (IČO ${c.ico})` : ""}</option>)}
              </select>
            </div>
          )}
          {!clientId && (
            <>
              <div className="grid grid-cols-2 gap-2 text-[14px] sm:max-w-80">
                {([["company", "Firma"], ["person", "Soukromá osoba"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setClient((c) => ({ ...c, kind: k }))}
                    className={`btn min-h-10 ${client.kind === k ? "bg-ink text-white" : "border border-line bg-white"}`}>{l}</button>
                ))}
              </div>
              {client.kind === "company" && (
                <div>
                  <label className="label" htmlFor="q-ico">IČO odběratele</label>
                  <div className="flex gap-2">
                    <input id="q-ico" className="field num" inputMode="numeric" maxLength={8} value={client.ico}
                      onChange={(e) => setClient((c) => ({ ...c, ico: e.target.value.replace(/\D/g, "") }))} placeholder="např. 25020137" />
                    <button type="button" className="btn-dark shrink-0" onClick={loadAres} disabled={client.ico.length < 6 || ares.loading}>
                      {ares.loading ? "Hledám…" : "Načíst z ARES"}
                    </button>
                  </div>
                  {ares.message && <p className={`mt-1 text-[13px] ${ares.ok ? "text-ok" : "text-warn"}`} role="status">{ares.message}</p>}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Field id="q-name" label={client.kind === "company" ? "Název firmy" : "Jméno a příjmení"} value={client.name} onChange={setC("name")} className="sm:col-span-2" />
                <Field id="q-street" label="Ulice a číslo" value={client.street} onChange={setC("street")} className="sm:col-span-2" />
                <Field id="q-city" label="Obec" value={client.city} onChange={setC("city")} />
                <Field id="q-zip" label="PSČ" value={client.zip} onChange={setC("zip")} />
                {client.kind === "company" && <Field id="q-dic" label="DIČ (nepovinné)" value={client.dic} onChange={setC("dic")} />}
                <Field id="q-email" label="E-mail (nepovinné)" value={client.email} onChange={setC("email")} type="email" />
              </div>
            </>
          )}
        </section>

        {/* Položky */}
        <section className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Co fakturujete</h2>
          <Field id="q-subject" label="Předmět faktury (nepovinné)" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="např. Malování bytu, Lipová 12" />
          <div className="space-y-2">
            {items.map((i, idx) => (
              <div key={i.key} className="rounded-xl border border-line bg-paper/60 p-3">
                <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-12">
                  <label className="col-span-2 block sm:col-span-5">
                    <span className="mb-0.5 block text-[11px] font-medium text-muted">Položka {idx + 1}</span>
                    <input className="field" value={i.description} placeholder="Popis práce nebo materiálu" list={catalog.length ? "q-catalog" : undefined}
                      onChange={(e) => updateItem(i.key, { description: e.target.value })} aria-label={`Popis položky ${idx + 1}`} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-0.5 block text-[11px] font-medium text-muted">Množství</span>
                    <input className="field num text-right" inputMode="decimal" value={i.qty} onChange={(e) => updateItem(i.key, { qty: clean(e.target.value) })} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-0.5 block text-[11px] font-medium text-muted">Jednotka</span>
                    <select className="field" value={i.unit} onChange={(e) => updateItem(i.key, { unit: e.target.value })}>
                      {DEFAULT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 block sm:col-span-3">
                    <span className="mb-0.5 block text-[11px] font-medium text-muted">{vatPayer ? "Cena/j bez DPH" : "Cena/j"}</span>
                    <input className="field num text-right" inputMode="decimal" value={i.unitPrice} onChange={(e) => updateItem(i.key, { unitPrice: clean(e.target.value) })} />
                  </label>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="num font-semibold">{formatCzk(lineTotal(parseInput(i.qty), parseInput(i.unitPrice)))}</p>
                  {items.length > 1 && (
                    <button type="button" className="text-[13px] text-muted underline hover:text-warn" onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}>Odebrat</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((l) => [...l, emptyItem()])} className="btn-ghost w-full border-dashed text-accent-ink">+ Přidat položku</button>
          {catalog.length > 0 && <datalist id="q-catalog">{catalog.map((c) => <option key={c.name} value={c.name} />)}</datalist>}
        </section>

        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          {vatPayer ? (
            <div>
              <span className="label">DPH</span>
              <div className="grid grid-cols-2 gap-2">
                {([21, 12] as const).map((r) => (
                  <button key={r} type="button" disabled={reverse} onClick={() => setVatRate(r)}
                    className={`btn min-h-10 ${!reverse && vatRate === r ? "bg-ink text-white" : "border border-line bg-white"}`}>{r} %</button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-[14px]">
                <input type="checkbox" className="size-5 accent-accent" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
                Přenesená daňová povinnost (stavební práce pro plátce)
              </label>
            </div>
          ) : (
            <p className="text-[14px] text-muted">Nejste plátce DPH – na faktuře bude „Nejsem plátce DPH“.</p>
          )}
          {vatPayer && (
            <div>
              <label className="label" htmlFor="q-duzp">Datum zdanitelného plnění</label>
              <input id="q-duzp" type="date" className="field" value={taxableDate} max={today} onChange={(e) => setTaxableDate(e.target.value)} />
            </div>
          )}
        </section>
      </div>

      {/* Souhrn a vystavení */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="card space-y-3 p-4">
          <h2 className="font-display text-[17px] font-bold">Souhrn</h2>
          {totals ? (
            <dl className="num space-y-1 text-[14px]">
              {vatMode === "standard" && (
                <>
                  <Row label="Bez DPH" value={formatCzk(totals.recap.reduce((s, r) => s + r.base, 0))} />
                  <Row label={`DPH ${vatRate} %`} value={formatCzk(totals.recap.reduce((s, r) => s + r.vat, 0))} />
                </>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-semibold">K úhradě</dt>
                <dd className="font-display text-[22px] font-extrabold">{formatCzk(totals.amountDue)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-[14px] text-muted">Doplňte položky a uvidíte částku.</p>
          )}
          <button type="button" className="btn-primary w-full" onClick={submit} disabled={pending || !totals}>
            {pending ? "Vystavuji…" : "Vystavit fakturu"}
          </button>
          {error && <p className="text-[13px] font-medium text-warn" role="alert">{error}</p>}
          <p className="text-[12px] text-muted">Faktura dostane číslo a už nepůjde změnit. Odběratel se uloží do adresáře klientů.</p>
        </div>
      </aside>
    </div>
  );
}

function Field({ id, label, className = "", ...rest }: { id: string; label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="field" {...rest} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{label}</dt><dd>{value}</dd></div>;
}
