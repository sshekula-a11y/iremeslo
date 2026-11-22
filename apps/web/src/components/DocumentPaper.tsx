import type { DocumentView } from "@/lib/documents/view";

/** Náhled dokladu na obrazovce – stejný obsah a rozvržení jako PDF. */
export function DocumentPaper({ v }: { v: DocumentView }) {
  const grand = v.totals.find((t) => t.strong);
  const rest = v.totals.filter((t) => !t.strong);
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
            <p className="font-display text-[20px] font-extrabold uppercase">{v.heading}</p>
            <p className="num font-semibold">č. {v.number}</p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <Party label="Dodavatel" party={v.supplier} />
          {v.customer ? <Party label="Odběratel" party={v.customer} /> : <div className="hidden rounded-xl border border-dashed border-line sm:block" />}
        </div>

        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {v.meta.map((m) => (
            <div key={m.label} className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">{m.label}</dt>
              <dd className="font-semibold">{m.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <h2 className="mb-2 text-[16px] font-bold">{v.title}</h2>
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

        <div className="ml-auto w-full max-w-72 space-y-1">
          {rest.map((t) => (
            <p key={t.label} className="num flex justify-between"><span className="text-muted">{t.label}</span><span>{t.value}</span></p>
          ))}
          {grand && (
            <p className="num flex items-center justify-between rounded-lg px-3 py-2" style={{ background: v.accent, color: v.accentText }}>
              <span className="font-bold">{grand.label}</span>
              <span className="font-display text-[19px] font-extrabold">{grand.value}</span>
            </p>
          )}
        </div>

        {v.notes.length > 0 && <div className="space-y-1">{v.notes.map((n, i) => <p key={i} className="whitespace-pre-line">{n}</p>)}</div>}
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
