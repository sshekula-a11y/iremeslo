"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyConsent, NO_TRACKING_PATHS, readConsent, saveConsent, subscribeConsent, type Consent } from "@/lib/consent";

const SERVER = { server: true } as const;

/** Cookie lišta (Přijmout vše / Odmítnout / Nastavení), nastavení cookies a načtení Google Tag Manageru po souhlasu. */
export function ConsentManager() {
  const path = usePathname();
  const stored = useSyncExternalStore<Consent | null | typeof SERVER>(subscribeConsent, readConsent, () => SERVER);
  const onServer = stored === SERVER;
  const consent: Consent | null = onServer ? null : (stored as Consent | null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // V aplikaci a administraci lištu neukazujeme: zakrývala by tlačítka a spodní menu. Rozhoduje se na veřejném webu;
  // bez souhlasu se GTM nenačte nikde.
  const admin = path.startsWith("/ssh") || path.startsWith("/app");
  const trackingAllowed = !NO_TRACKING_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  useEffect(() => {
    if (consent) applyConsent(consent, trackingAllowed);
  }, [consent, trackingAllowed]);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener("iremeslo:cookie-settings", open);
    return () => window.removeEventListener("iremeslo:cookie-settings", open);
  }, []);

  if (onServer || admin) return null;
  const decided = consent !== null;

  return (
    <>
      {!decided && !settingsOpen && (
        <div role="region" aria-label="Souhlas s cookies"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 text-[13px] sm:px-5">
            <p className="min-w-0 flex-1 basis-64 text-white/85">
              <strong className="text-white">Používáme cookies.</strong>{" "}
              <span className="hidden sm:inline">Nezbytné potřebujeme k fungování webu. Analytické (Google Analytics) a reklamní (Google Ads, Sklik, Meta) načteme jen s vaším souhlasem.</span>
              <span className="sm:hidden">Analytické a reklamní jen s vaším souhlasem.</span>{" "}
              <Link href="/ochrana-osobnich-udaju#cookies" className="whitespace-nowrap font-semibold text-white underline underline-offset-2">Více</Link>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setSettingsOpen(true)} className="min-h-9 rounded-lg px-2 font-semibold text-white underline underline-offset-2 hover:text-white/80">
                Nastavení
              </button>
              {/* Odmítnout je stejně výrazné jako Přijmout (doporučení ÚOOÚ). */}
              <button type="button" onClick={() => saveConsent(false, false)} className="min-h-9 rounded-lg bg-white px-3 font-semibold text-ink hover:bg-white/90">
                Odmítnout
              </button>
              <button type="button" onClick={() => saveConsent(true, true)} className="min-h-9 rounded-lg bg-white px-3 font-semibold text-ink hover:bg-white/90">
                Přijmout vše
              </button>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <CookieSettings current={consent} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}

function CookieSettings({ current, onClose }: { current: Consent | null; onClose: () => void }) {
  const [analytics, setAnalytics] = useState(current?.analytics ?? false);
  const [marketing, setMarketing] = useState(current?.marketing ?? false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const done = (a: boolean, m: boolean) => { saveConsent(a, m); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cookies-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 text-ink shadow-xl outline-none sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="cookies-title" className="font-display text-[22px] font-extrabold">Nastavení cookies</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Nezbytné cookies potřebujeme k fungování webu. Analytické cookies Google Analytics měří návštěvnost. Reklamní cookies
          Google Ads, Sklik a Meta měří výsledky reklamy a pomáhají s jejím cílením. Volitelné značky načteme jen s vaším souhlasem.
          Kontaktní údaje ani obsah vašich zakázek a dokladů reklamním systémům neposíláme. Souhlas můžete kdykoli změnit odkazem
          „Nastavení cookies“ v patičce webu.
        </p>

        <div className="mt-4 divide-y divide-line rounded-xl border border-line">
          <Row title="Nezbytné" text="Přihlášení, vybraná firma a tato volba. Bez nich web nefunguje." checked disabled />
          <Row title="Analytické" text="Google Analytics – kolik lidí web navštěvuje a co používají." checked={analytics} onChange={setAnalytics} />
          <Row title="Reklamní" text="Google Ads, Sklik a Meta – měření a cílení reklamy." checked={marketing} onChange={setMarketing} />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => done(analytics, marketing)} className="btn-dark whitespace-nowrap">Uložit výběr</button>
          <button type="button" onClick={() => done(false, false)} className="btn-ghost whitespace-nowrap">Odmítnout vše</button>
          <button type="button" onClick={() => done(true, true)} className="btn-ghost whitespace-nowrap">Přijmout vše</button>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Podrobnosti v <Link href="/ochrana-osobnich-udaju#cookies" className="font-semibold text-accent-ink underline" onClick={onClose}>zásadách ochrany osobních údajů</Link>.
        </p>
      </div>
    </div>
  );
}

function Row({ title, text, checked, disabled, onChange }: {
  title: string; text: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 p-3.5 ${disabled ? "" : "cursor-pointer"}`}>
      <span>
        <span className="block font-semibold">{title}{disabled && <span className="ml-1.5 text-[12px] font-normal text-muted">(vždy zapnuté)</span>}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-accent disabled:opacity-60" aria-label={title} />
    </label>
  );
}
