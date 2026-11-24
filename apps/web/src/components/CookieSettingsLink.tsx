"use client";

import { openCookieSettings } from "@/lib/consent";

/** Odkaz „Nastavení cookies“ – otevře nastavení, kde jde souhlas kdykoli změnit nebo odvolat. */
export function CookieSettingsLink({ className = "", children = "Nastavení cookies" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>{children}</button>
  );
}
