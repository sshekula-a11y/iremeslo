// Popisky sdílené serverem i prohlížečem.

export const JOB_STATUSES = {
  inquiry: "Poptávka",
  quote_sent: "Nabídka odeslána",
  approved: "Schváleno",
  in_progress: "Probíhá",
  done: "Dokončeno",
  invoiced: "Vyfakturováno",
  paid: "Zaplaceno",
  rejected: "Zamítnuto",
} as const;
export type JobStatus = keyof typeof JOB_STATUSES;

export const ROLE_LABELS = { owner: "Majitel", office: "Kancelář", worker: "Pracovník" } as const;

export const VAT_MODE_LABELS = {
  standard: "Plátce DPH",
  reverse_charge: "Přenesená daňová povinnost (0 %)",
  non_payer: "Neplátce DPH",
} as const;
