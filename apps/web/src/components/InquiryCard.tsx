import Link from "next/link";
import { CATEGORY_LABEL, formatQuantity, formatTerm, timeAgo, type PublicInquiry } from "@/lib/inquiries";

/** Karta veřejné poptávky v seznamu (bez kontaktu). */
export function InquiryCard({ q }: { q: PublicInquiry }) {
  const qty = formatQuantity(q.quantity, q.unit);
  return (
    <Link href={`/poptavky/${q.id}`} className="card group flex flex-col gap-2 p-4 transition hover:border-ink/30 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
        <span className="rounded-full bg-paper px-2 py-0.5 font-semibold text-ink">{CATEGORY_LABEL[q.category] ?? q.category}</span>
        <span>{timeAgo(q.created_at)}</span>
      </div>
      <h3 className="font-display text-[18px] font-bold leading-snug group-hover:text-accent-ink">{q.title}</h3>
      <p className="line-clamp-2 text-[14px] text-muted">{q.description}</p>
      <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[14px]">
        {qty && <div className="flex gap-1"><dt className="sr-only">Rozsah</dt><dd className="num font-semibold">{qty}</dd></div>}
        <div className="flex gap-1"><dt className="sr-only">Místo</dt><dd>📍 {q.city}</dd></div>
        <div className="flex gap-1"><dt className="sr-only">Termín</dt><dd className="text-muted">{formatTerm(q.term, q.term_date)}</dd></div>
      </dl>
    </Link>
  );
}

/** Kompaktní řádek poptávky (úvodní stránka – posledních 10). Na telefonu je čas v druhém řádku, ať se vejde název. */
export function InquiryRow({ q }: { q: PublicInquiry }) {
  const qty = formatQuantity(q.quantity, q.unit);
  const ago = timeAgo(q.created_at);
  return (
    <li>
      <Link href={`/poptavky/${q.id}`} className="group flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-paper sm:px-5">
        <span className="min-w-0">
          <span className="line-clamp-2 font-semibold leading-snug group-hover:text-accent-ink sm:line-clamp-1">{q.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
            <span className="sm:hidden">{ago} · </span>
            {q.city}{qty ? <> · <span className="num">{qty}</span></> : null}
            <span className="hidden sm:inline"> · {CATEGORY_LABEL[q.category] ?? q.category} · {formatTerm(q.term, q.term_date)}</span>
          </span>
        </span>
        <span className="hidden shrink-0 whitespace-nowrap pt-0.5 text-[12px] text-muted sm:block">{ago}</span>
      </Link>
    </li>
  );
}
