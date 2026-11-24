import Link from "next/link";
import type { Faq } from "@/lib/faq";

/** Rozbalovací seznam otázek (funguje i bez JavaScriptu). */
export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((f) => (
        <details key={f.q} className="group p-4 sm:px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
            {f.q}
            <span aria-hidden="true" className="text-[20px] text-muted transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {f.a}
            {f.link && <> <Link href={f.link.href} className="font-semibold text-accent-ink underline">{f.link.label} →</Link></>}
          </p>
        </details>
      ))}
    </div>
  );
}
