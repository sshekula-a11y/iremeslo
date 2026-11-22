import { JOB_STATUSES, type JobStatus } from "@/lib/labels";

export const STATUS_COLORS: Record<JobStatus, string> = {
  inquiry: "bg-paper text-muted",
  quote_sent: "bg-[#e7f1fb] text-[#1d5fa8]",
  approved: "bg-[#efedff] text-[#5a45c7]",
  in_progress: "bg-accent-soft text-accent-ink",
  done: "bg-ok-soft text-ok",
  invoiced: "bg-[#f9eeda] text-[#8a5a00]",
  paid: "bg-ok text-white",
  rejected: "bg-warn-soft text-warn",
};

/** Plné barvy pro tečky (legenda, seznam v kalendáři). */
export const STATUS_DOTS: Record<JobStatus, string> = {
  inquiry: "bg-[#98a2b3]",
  quote_sent: "bg-[#1d5fa8]",
  approved: "bg-[#5a45c7]",
  in_progress: "bg-accent",
  done: "bg-ok",
  invoiced: "bg-[#8a5a00]",
  paid: "bg-ok",
  rejected: "bg-warn",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_COLORS[status] ?? STATUS_COLORS.inquiry}`}>
      {JOB_STATUSES[status] ?? status}
    </span>
  );
}
