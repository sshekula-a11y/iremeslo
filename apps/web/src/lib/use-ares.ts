"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidIco } from "@iremeslo/core";
import type { AresCompany } from "@/lib/types";

export interface AresStatus { loading: boolean; ok?: boolean; message?: string }

/**
 * Načtení firmy z ARES podle IČO – stejné ve všech formulářích (registrace, nastavení, zákazníci, faktura).
 * `onIcoInput` načte údaje samo, jakmile je zadané platné 8místné IČO (bez klikání).
 */
export function useAres(onLoaded: (c: AresCompany) => void) {
  const [status, setStatus] = useState<AresStatus>({ loading: false });
  const last = useRef("");
  const cb = useRef(onLoaded);
  useEffect(() => { cb.current = onLoaded; });

  const load = useCallback(async (raw: string) => {
    const ico = raw.replace(/\D/g, "");
    if (!isValidIco(ico)) { setStatus({ loading: false, message: "IČO není platné. Zkontrolujte číslice." }); return; }
    last.current = ico;
    setStatus({ loading: true });
    try {
      const res = await fetch(`/api/ares/${encodeURIComponent(ico)}`);
      const body = (await res.json()) as AresCompany | { error: string };
      if (last.current !== ico) return; // mezitím se IČO změnilo
      if (!res.ok || "error" in body) { setStatus({ loading: false, message: "error" in body ? body.error : "Údaje se nepodařilo načíst." }); return; }
      cb.current(body);
      setStatus({ loading: false, ok: true, message: "Údaje jsme načetli z ARES. Zkontrolujte je." });
    } catch {
      setStatus({ loading: false, message: "ARES teď neodpovídá. Údaje vyplňte ručně." });
    }
  }, []);

  /** Volat při psaní do pole IČO: po 8. platné číslici načte údaje (každé IČO jen jednou). */
  const onIcoInput = useCallback((raw: string) => {
    const ico = raw.replace(/\D/g, "");
    if (ico.length === 8 && isValidIco(ico) && ico !== last.current) void load(ico);
    if (ico.length < 8) { last.current = ""; setStatus({ loading: false }); }
  }, [load]);

  return { status, load, onIcoInput };
}

/** Řádek se stavem načítání pod polem IČO. */
export function aresStatusClass(s: AresStatus) {
  return s.ok ? "text-ok" : s.loading ? "text-muted" : "text-warn";
}
