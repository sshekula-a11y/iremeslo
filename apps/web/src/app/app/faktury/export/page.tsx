import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/data";
import { todayInPrague } from "@/lib/calendar";
import { ExportClient } from "./ExportClient";

export const metadata: Metadata = { title: "Export pro účetní" };

/** Export dokladů pro účetní: ZIP s ISDOC (načte ho účetní program), PDF a přehledem v Excelu. */
export default async function ExportPage() {
  await requireStaff();
  const today = todayInPrague();
  // výchozí období = minulý měsíc (účetní ho obvykle chce začátkem dalšího)
  const [y, m] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const from = prev.toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/app/faktury" className="text-[14px] text-muted hover:text-ink">← Faktury</Link>
      <div>
        <h1 className="font-display text-[26px] font-extrabold">Export pro účetní</h1>
        <p className="text-[14px] text-muted">
          Faktury, zálohové faktury a daňové doklady k platbě za zvolené období v jednom ZIP souboru.
        </p>
      </div>
      <ExportClient defaultFrom={from} defaultTo={to} />
      <section className="card space-y-2 p-4 text-[14px] sm:p-5">
        <h2 className="font-display text-[17px] font-bold">Co ZIP obsahuje</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li><strong className="text-ink">isdoc/</strong> – každý doklad ve formátu ISDOC 6.0.2. Načte ho Pohoda, Money S3, ABRA, Helios, iDoklad i další programy (import ISDOC).</li>
          <li><strong className="text-ink">pdf/</strong> – doklady v PDF, jak je dostal zákazník.</li>
          <li><strong className="text-ink">prehled.csv</strong> – seznam dokladů se základem, DPH a stavem úhrady (otevřete v Excelu).</li>
        </ul>
      </section>
    </div>
  );
}
