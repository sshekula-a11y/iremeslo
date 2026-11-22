/** Stav faktury pro člověka: zaplacená, po splatnosti, čeká na platbu. */
export type DocState = "paid" | "overdue" | "unpaid" | "info";

export function docState(type: string, status: string, dueDate: string | null, today: string): DocState {
  if (type === "ddpp" || type === "quote") return "info";
  if (status === "paid") return "paid";
  if (dueDate && dueDate < today) return "overdue";
  return "unpaid";
}

const STYLES: Record<DocState, [string, string]> = {
  paid: ["bg-ok-soft text-ok", "Zaplaceno"],
  overdue: ["bg-warn-soft text-warn", "Po splatnosti"],
  unpaid: ["bg-accent-soft text-accent-ink", "Čeká na platbu"],
  info: ["bg-paper text-muted ring-1 ring-line", "Vystaveno"],
};

export function DocStatusBadge({ state }: { state: DocState }) {
  const [cls, label] = STYLES[state];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${cls}`}>{label}</span>;
}
