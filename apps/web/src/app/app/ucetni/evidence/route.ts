import { requireStaff } from "@/lib/data";
import { todayInPrague } from "@/lib/calendar";
import { yearData } from "@/lib/tax/data";
import { CATEGORY_LABEL } from "@/lib/expenses";

/** Daňová evidence za rok jako CSV pro Excel (středník, čárka v číslech, BOM kvůli diakritice). */
export async function GET(req: Request) {
  const company = await requireStaff();
  const thisYear = Number(todayInPrague().slice(0, 4));
  const rok = Number(new URL(req.url).searchParams.get("rok"));
  const year = Number.isInteger(rok) && rok >= 2000 && rok <= thisYear ? rok : thisYear;
  const d = await yearData(company.id, year, company.vatPayer);
  const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const lines = [
    `Daňová evidence ${year};${cell(company.name)};IČO ${company.ico ?? ""}`,
    "",
    "PŘÍJMY;;;;",
    "Datum úhrady;Doklad;Odběratel;Částka" + (company.vatPayer ? " bez DPH" : "") + " (Kč);Poznámka",
    ...d.incomeRows.map((r) => [r.date, cell(r.doc), cell(r.customer), num(r.amount), r.assumed ? "převzatá faktura bez data úhrady" : ""].join(";")),
    `Příjmy celkem;;;${num(d.income)};`,
    "",
    "VÝDAJE;;;;",
    "Datum;Dodavatel;Doklad;Kategorie;Částka" + (company.vatPayer ? " bez DPH" : "") + " (Kč)",
    ...d.expenseRows.map((r) => [r.date, cell(r.supplier), cell(r.doc), cell(CATEGORY_LABEL[r.category] ?? r.category), num(r.amount)].join(";")),
    `Výdaje celkem;;;;${num(d.expenses)}`,
    "",
    `Rozdíl příjmů a výdajů;;;;${num(d.income - d.expenses)}`,
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="danova-evidence-${year}.csv"`,
      "cache-control": "no-store",
    },
  });
}
