import { toRoman, type DocumentView } from "@/lib/documents/view";

/** Náhled dokladu na obrazovce – stejný obsah a rozvržení jako PDF. */
export function DocumentPaper({ v }: { v: DocumentView }) {
  const grand = v.totals.find((t) => t.strong);
  const rest = v.totals.filter((t) => !t.strong);
  const [supplierLabel, customerLabel] = v.partyLabels ?? ["Dodavatel", "Odběratel"];
  const hasItems = v.rows.length > 0 || v.totals.length > 0;
  return (
    <article className="card overflow-hidden text-[14px]" aria-label={`${v.heading} ${v.number}`}>
      <div className="h-1.5" style={{ background: v.accent }} />
      <div className="space-y-5 p-4 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt={v.supplier.name} className="max-h-12 max-w-44 object-contain" />
          ) : (
            <p className="max-w-80 font-display text-[20px] font-extrabold">{v.supplier.name}</p>
          )}
          <div className="sm:text-right">
            <p className={`font-display font-extrabold uppercase ${v.heading.length > 20 ? "text-[17px]" : "text-[20px]"}`}>{v.heading}</p>
            <p className="num font-semibold">č. {v.number}</p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <Party label={supplierLabel} party={v.supplier} />
          {v.customer ? <Party label={customerLabel} party={v.customer} /> : <div className="hidden rounded-xl border border-dashed border-line sm:block" />}
        </div>

        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {v.meta.map((m) => (
            <div key={m.label} className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">{m.label}</dt>
              <dd className="font-semibold">{m.value}</dd>
            </div>
          ))}
        </dl>

        <h2 className="text-[16px] font-bold">{v.title}</h2>

        {v.articles && (
          <ol className="space-y-4">
            {v.articles.map((a, i) => (
              <li key={i}>
                <h3 className="font-bold">{toRoman(i + 1)}. {a.title}</h3>
                {a.paragraphs.map((p, j) => <p key={j} className="mt-1 whitespace-pre-line leading-relaxed">{p}</p>)}
              </li>
            ))}
          </ol>
        )}

        {v.blanks && (
          <div className="space-y-3">
            {v.blanks.map((b) => (
              <div key={b.label}>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{b.label}</p>
                {Array.from({ length: b.lines }, (_, k) => <div key={k} className="h-7 border-b border-dotted border-ink/40" />)}
              </div>
            ))}
          </div>
        )}

        {hasItems && <>
        <div>
          {/* Počítač: tabulka */}
          <table className="hidden w-full sm:table">
            <thead>
              <tr style={{ background: v.accent, color: v.accentText }} className="text-[11px] uppercase tracking-wide">
                <th className="rounded-l-md px-2 py-2 text-left font-bold">{v.columns.description}</th>
                <th className="px-2 py-2 text-right font-bold">{v.columns.qty}</th>
                <th className="px-2 py-2 text-left font-bold">{v.columns.unit}</th>
                <th className="px-2 py-2 text-right font-bold">{v.columns.unitPrice}</th>
                <th className="rounded-r-md px-2 py-2 text-right font-bold">{v.columns.total}</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="px-2 py-2">{r.description}</td>
                  <td className="num px-2 py-2 text-right">{r.qty}</td>
                  <td className="px-2 py-2">{r.unit}</td>
                  <td className="num px-2 py-2 text-right">{r.unitPrice}</td>
                  <td className="num px-2 py-2 text-right font-semibold">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Telefon: řádky pod sebou */}
          <ul className="divide-y divide-line border-y border-line sm:hidden">
            {v.rows.map((r, i) => (
              <li key={i} className="py-2">
                <p>{r.description}</p>
                <p className="num flex justify-between text-[13px] text-muted">
                  <span>{r.qty} {r.unit} × {r.unitPrice}</span>
                  <span className="font-semibold text-ink">{r.total}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-start sm:justify-between">
          {v.recap ? (
            <div className="w-full max-w-sm">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Rekapitulace DPH</p>
              <table className="num w-full text-[13px]">
                <thead>
                  <tr className="border-b border-ink text-left">
                    <th className="py-1 font-semibold">Sazba</th>
                    <th className="py-1 text-right font-semibold">Základ</th>
                    <th className="py-1 text-right font-semibold">DPH</th>
                    <th className="py-1 text-right font-semibold">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {v.recap.map((r, i) => (
                    <tr key={i} className={`border-b border-line ${r.muted ? "text-muted" : ""}`}>
                      <td className="py-1 pr-2">{r.label}</td>
                      <td className="py-1 text-right">{r.base}</td>
                      <td className="py-1 text-right">{r.vat}</td>
                      <td className="py-1 text-right">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="hidden sm:block" />}
        <div className="w-full space-y-1 sm:max-w-72">
          {rest.map((t) => (
            <p key={t.label} className="num flex justify-between gap-3"><span className="text-muted">{t.label}</span><span className="shrink-0 text-right">{t.value}</span></p>
          ))}
          {grand && (
            <p className="num flex items-center justify-between rounded-lg px-3 py-2" style={{ background: v.accent, color: v.accentText }}>
              <span className="font-bold">{grand.label}</span>
              <span className="font-display text-[19px] font-extrabold">{grand.value}</span>
            </p>
          )}
        </div>

        </div>

        {v.payment && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-3 sm:p-4">
            <dl className="min-w-52 flex-1 space-y-0.5 text-[13px]">
              {v.payment.lines.map((l) => (
                <div key={l.label} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-muted">{l.label}</dt>
                  <dd className="num font-semibold">{l.value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">K úhradě</p>
              <p className="num font-display text-[22px] font-extrabold">{v.payment.amount}</p>
            </div>
            {v.payment.qrDataUrl && (
              <figure className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.payment.qrDataUrl} alt="QR Platba – naskenujte v bankovní aplikaci" className="size-28" />
                <figcaption className="mt-1 text-[11px] text-muted">QR Platba</figcaption>
              </figure>
            )}
          </div>
        )}

        </>}

        {v.notes.length > 0 && <div className="space-y-1">{v.notes.map((n, i) => <p key={i} className="whitespace-pre-line">{n}</p>)}</div>}
        {v.signatures && (
          <div className="pt-2">
            {v.signatures.place && <p className="mb-6 text-[13px]">{v.signatures.placeText ?? "V ……………………… dne ………………"}</p>}
            <div className="grid grid-cols-2 gap-6 sm:gap-12">
              <div className="text-center">
                <div className="flex h-20 items-end justify-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.stampUrl && <img src={v.stampUrl} alt="Razítko" className="max-h-20 max-w-28 object-contain" />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.signatures.leftSigned ? <img src={v.signatures.leftSigned.image} alt="Podpis prstem" className="max-h-20 max-w-36 object-contain" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : v.signatureUrl && <img src={v.signatureUrl} alt="Podpis" className="max-h-20 max-w-28 object-contain" />}
                </div>
                <p className="mt-1 border-t border-ink/40 pt-1 text-[12px] text-muted">{v.signatures.left}<br />{v.supplier.name}
                  {v.signatures.leftSigned && <><br /><span className="text-[11px]">{v.signatures.leftSigned.caption}</span></>}</p>
              </div>
              <div className="text-center">
                <div className="flex h-20 items-end justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.signatures.rightSigned && <img src={v.signatures.rightSigned.image} alt="Podpis prstem" className="max-h-20 max-w-36 object-contain" />}
                </div>
                <p className="mt-1 border-t border-ink/40 pt-1 text-[12px] text-muted">{v.signatures.right}<br />{v.customer?.name}
                  {v.signatures.rightSigned && <><br /><span className="text-[11px]">{v.signatures.rightSigned.caption}</span></>}</p>
              </div>
            </div>
            {v.signatures.note && <p className="mt-3 text-[11px] text-muted">{v.signatures.note}</p>}
          </div>
        )}
        {!v.signatures && (v.stampUrl || v.signatureUrl) && (
          <div className="ml-auto w-56 text-center">
            <div className="flex h-20 items-end justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.stampUrl && <img src={v.stampUrl} alt="Razítko" className="max-h-20 max-w-28 object-contain" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.signatureUrl && <img src={v.signatureUrl} alt="Podpis" className="max-h-20 max-w-28 object-contain" />}
            </div>
            <p className="mt-1 border-t border-line pt-1 text-[12px] text-muted">Razítko a podpis dodavatele</p>
          </div>
        )}
        <p className="border-t border-line pt-2 text-[12px] text-muted">{v.footer}</p>
      </div>
    </article>
  );
}

function Party({ label, party }: { label: string; party: { name: string; lines: string[] } }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-bold">{party.name}</p>
      {party.lines.map((l, i) => <p key={i} className="text-[13px] text-muted">{l}</p>)}
    </div>
  );
}

