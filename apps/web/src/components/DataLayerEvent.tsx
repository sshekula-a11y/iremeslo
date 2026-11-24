"use client";

import { useEffect } from "react";
import { pushEvent } from "@/lib/consent";

/** Odešle do GTM jednu událost při zobrazení stránky (např. dokončená registrace, odeslaná poptávka). */
export function DataLayerEvent({ name }: { name: string }) {
  useEffect(() => { pushEvent(name); }, [name]);
  return null;
}
