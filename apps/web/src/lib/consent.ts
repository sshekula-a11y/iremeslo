/**
 * Souhlas s cookies a Google Tag Manager (GTM-NFNGHP3Q).
 *  - GTM se načte AŽ po souhlasu s analytickými nebo reklamními cookies (§ 89 odst. 3 z. 127/2005 Sb.).
 *  - Google Consent Mode v2: výchozí stav vše „denied“, pak „update“ podle volby návštěvníka.
 *  - Volba se pamatuje 12 měsíců v prohlížeči (localStorage), pak se zeptáme znovu.
 *  - Na stránkách s tajným odkazem v adrese (správa poptávky, potvrzení e-mailu) a v administraci se GTM nenačítá,
 *    aby se token nedostal do Google Analytics.
 */
export const GTM_ID = "GTM-NFNGHP3Q";
const KEY = "iremeslo-consent";
const MAX_AGE_MS = 365 * 24 * 3600 * 1000;
export const NO_TRACKING_PATHS = ["/ssh", "/poptavky/sprava", "/overeni", "/auth"];

export interface Consent { v: 1; analytics: boolean; marketing: boolean; ts: number }

type Win = Window & { dataLayer?: unknown[]; __iremesloGtm?: boolean };

let cached: Consent | null | undefined;
const listeners = new Set<() => void>();

export function subscribeConsent(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Uložená volba, nebo null (ještě se nerozhodl / volba je starší než 12 měsíců). */
export function readConsent(): Consent | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    const c = raw ? (JSON.parse(raw) as Consent) : null;
    cached = c && c.v === 1 && Date.now() - c.ts < MAX_AGE_MS ? c : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function saveConsent(analytics: boolean, marketing: boolean) {
  const before = readConsent();
  const c: Consent = { v: 1, analytics, marketing, ts: Date.now() };
  cached = c;
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* soukromé okno – platí do zavření stránky */ }
  listeners.forEach((l) => l());
  const revoked = (before?.analytics && !analytics) || (before?.marketing && !marketing);
  if (revoked) {
    // Odvolání souhlasu: informovat značky, smazat jejich cookies a znovu načíst stránku bez nich.
    applyConsent(c, true);
    deleteTrackingCookies();
    window.location.reload();
  }
}

/** Otevře nastavení cookies (odkaz v patičce, na stránce GDPR). */
export function openCookieSettings() {
  window.dispatchEvent(new Event("iremeslo:cookie-settings"));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  const w = window as Win;
  w.dataLayer = w.dataLayer || [];
  // GTM vyžaduje objekt arguments, ne pole.
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
}

/** Předá volbu značkám; GTM načte jen při souhlasu (a ne na stránkách bez měření). */
export function applyConsent(c: Consent, allowedPath: boolean) {
  const w = window as Win;
  const anyGranted = c.analytics || c.marketing;
  if (!w.__iremesloGtm && (!anyGranted || !allowedPath)) return;
  if (!w.__iremesloGtm) {
    gtag("consent", "default", {
      ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
      analytics_storage: "denied", functionality_storage: "granted", security_storage: "granted",
    });
  }
  gtag("consent", "update", {
    analytics_storage: c.analytics ? "granted" : "denied",
    ad_storage: c.marketing ? "granted" : "denied",
    ad_user_data: c.marketing ? "granted" : "denied",
    ad_personalization: c.marketing ? "granted" : "denied",
  });
  w.dataLayer!.push({ event: "consent_update", analytics_consent: c.analytics, marketing_consent: c.marketing });
  if (!w.__iremesloGtm) {
    w.__iremesloGtm = true;
    gtag("js", new Date());
    w.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(s);
  }
}

/** Událost pro GTM (registrace, odeslaná poptávka). Bez souhlasu zůstane jen ve frontě v prohlížeči. */
export function pushEvent(event: string, data: Record<string, unknown> = {}) {
  const w = window as Win;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...data });
}

function deleteTrackingCookies() {
  const names = document.cookie.split(";").map((c) => c.split("=")[0]!.trim())
    .filter((n) => /^(_ga|_gid|_gat|_gcl|_fbp|_fbc|sid|_uet|IDE|test_cookie)/.test(n));
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.replace(/^www\./, "")}`];
  for (const n of names) for (const d of domains) {
    document.cookie = `${n}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
  }
}
