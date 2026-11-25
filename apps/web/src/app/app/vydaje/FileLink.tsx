"use client";

import { useState } from "react";
import { expenseFileUrl } from "./actions";

/** Otevře účtenku výdaje (dočasný odkaz do soukromého úložiště). */
export function FileLink({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="text-[13px] font-semibold text-accent-ink underline disabled:opacity-50" disabled={busy}
      onClick={async () => {
        setBusy(true);
        const w = window.open("", "_blank");
        const url = await expenseFileUrl(id).catch(() => null);
        setBusy(false);
        if (url && w) w.location.href = url; else { w?.close(); alert("Účtenku se nepodařilo otevřít."); }
      }}>Účtenka</button>
  );
}
