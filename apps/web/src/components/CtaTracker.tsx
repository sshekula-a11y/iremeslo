"use client";

import { useEffect } from "react";
import { pushEvent } from "@/lib/consent";

/** Hlavní výzvy webu a jejich název v Google Analytics. */
const CTAS: [RegExp, string][] = [
  [/^\/poptavky\/nova(\?|$)/, "zadat_poptavku"],
  [/^\/prihlaseni\?rezim=registrace/, "vyzkouset_zdarma"],
  [/^\/registrace-firmy/, "zaregistrovat_firmu"],
];

/**
 * Událost cta_click pro klik na „Zadat poptávku“ / „Vyzkoušet zdarma“ s místem, kde tlačítko je
 * (sekce stránky, hlavička, patička). Do Google Analytics dorazí jen se souhlasem – GTM se bez něj nenačte.
 */
export function CtaTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      const cta = CTAS.find(([re]) => re.test(href))?.[1];
      if (!cta) return;
      // data-place (hlavička, menu, patička) → sekce stránky → úvodní pás stránky
      const place = a.closest("[data-place]")?.getAttribute("data-place")
        ?? a.closest("[aria-labelledby]")?.getAttribute("aria-labelledby")
        ?? (a.closest("header") ? "uvod" : "stranka");
      pushEvent("cta_click", { cta, cta_place: place, page_path: location.pathname });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
