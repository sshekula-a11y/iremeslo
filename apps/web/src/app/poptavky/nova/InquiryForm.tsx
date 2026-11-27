"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INQUIRY_CATEGORIES, INQUIRY_TERMS, INQUIRY_UNITS, REGIONS, regionFromZip } from "@/lib/inquiries";
import { pushEvent } from "@/lib/consent";
import { PhotoPicker } from "./PhotoPicker";
import { createClient } from "@/lib/supabase/client";
import { inquiryError, validateInquiry } from "./validate";

const STEPS = ["Co poptáváte", "Kde a kdy", "Kontakt"] as const;
/** Rozepsaná poptávka v prohlížeči (jen na tomto zařízení; souhlas a past na roboty se neukládají). */
const DRAFT_KEY = "iremeslo-poptavka-koncept";
const NOT_SAVED = new Set(["consent", "web"]);

type Draft = Record<string, string>;
function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const d = raw ? (JSON.parse(raw) as Draft) : null;
    return d && Object.values(d).some((v) => v) ? d : null;
  } catch { return null; }
}
function writeDraft(form: HTMLFormElement) {
  try {
    const d: Draft = {};
    new FormData(form).forEach((v, k) => { if (!NOT_SAVED.has(k) && typeof v === "string") d[k] = v; });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch { /* soukromé okno, zablokované úložiště – formulář funguje i bez konceptu */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* nic */ }
}

/** Poptávka ve třech krocích: Co → Kde a kdy → Kontakt. Rozepsané údaje se průběžně ukládají v prohlížeči. */
export function InquiryForm({ today, defaultCategory = "" }: { today: string; defaultCategory?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string }>({});
  const [pending, setPending] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [step, setStep] = useState(0);
  const [term, setTerm] = useState("flexible");
  const [termFrom, setTermFrom] = useState("");
  const [termDate, setTermDate] = useState("");
  // Kraj předvyplníme podle PSČ, dokud ho zadavatel nezmění sám.
  const [region, setRegion] = useState("");
  const [regionTouched, setRegionTouched] = useState(false);
  const [restored, setRestored] = useState(false);
  const [photosFolder, setPhotosFolder] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const topRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Obnovení konceptu po načtení (localStorage na serveru není, proto až v prohlížeči).
  useEffect(() => {
    const d = readDraft();
    const form = formRef.current;
    if (!d || !form) return;
    for (const [k, v] of Object.entries(d)) {
      const el = form.elements.namedItem(k);
      if (el instanceof HTMLInputElement && el.type !== "radio" || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.value = v;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- jednorázové obnovení konceptu z úložiště prohlížeče */
    if (d.term) setTerm(d.term);
    if (d.term_from) setTermFrom(d.term_from);
    if (d.term_date) setTermDate(d.term_date);
    if (d.photos_folder && /^[0-9a-f-]{36}$/.test(d.photos_folder)) setPhotosFolder(d.photos_folder);
    if (d.region) { setRegion(d.region); setRegionTouched(true); }
    else if (d.zip) { const r = regionFromZip(d.zip); if (r) setRegion(r); }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /** Zkontroluje pole kroku; první chybné ukáže prohlížeč. */
  const stepValid = (i: number) => {
    const fields = sections.current[i]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") ?? [];
    for (const el of fields) if (!el.checkValidity()) return el;
    return null;
  };
  const go = (i: number) => {
    setStep(i);
    pushEvent("inquiry_step", { step: i + 1 });
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const next = () => {
    const bad = stepValid(step);
    if (bad) return bad.reportValidity();
    go(step + 1);
  };

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-5">
      <ol className="grid grid-cols-3 gap-2" aria-label="Postup">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <span className={`block h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} aria-hidden="true" />
            <span className={`mt-1.5 block text-[13px] ${i === step ? "font-bold text-ink" : "text-muted"}`}>
              <span className="num">{i + 1}.</span> {label}
            </span>
          </li>
        ))}
      </ol>

      {restored && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-[14px]">
          Obnovili jsme vaši rozepsanou poptávku.
          <button type="button" className="font-semibold text-accent-ink underline" onClick={() => {
            clearDraft();
            formRef.current?.reset();
            setTerm("flexible"); setTermFrom(""); setTermDate(""); setRegion(""); setRegionTouched(false); setPhotosFolder(""); setPhotoKey((k) => k + 1); setRestored(false); go(0);
          }}>Začít znovu</button>
        </p>
      )}

    {/* Odeslání bez resetu formuláře: při chybě zůstane vše vyplněné. Kontrolu polí dělají kroky (noValidate). */}
    <form ref={formRef} noValidate className="space-y-5" onChange={(e) => {
      writeDraft(e.currentTarget);
      // Měření: první vyplněné pole (jen jednou za návštěvu formuláře).
      if (!started.current) { started.current = true; pushEvent("inquiry_start"); }
    }} onSubmit={(e) => {
      e.preventDefault();
      for (let i = 0; i < STEPS.length; i++) {
        const bad = stepValid(i);
        if (bad) { setStep(i); requestAnimationFrame(() => bad.reportValidity()); return; }
      }
      const data = new FormData(e.currentTarget);
      // Past na roboty: vyplněné skryté pole nebo odeslání do 3 s od otevření – tváříme se, že je hotovo.
      if (String(data.get("web") ?? "") !== "" || Date.now() - openedAt < 3000) { router.push("/poptavky/odeslano"); return; }
      const check = validateInquiry(data, today);
      if ("error" in check) { setState({ error: check.error }); return; }
      setPending(true);
      setState({});
      createClient().rpc("submit_inquiry", { p: check.payload }).then(({ error }) => {
        if (error) { setPending(false); setState({ error: inquiryError(error.message) }); return; }
        clearDraft();
        // Bez e-mailu v adrese – adresy stránek zaznamenává Google Analytics.
        router.push("/poptavky/odeslano");
      }, () => { setPending(false); setState({ error: "Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu." }); });
    }}>
      <section ref={(el) => { sections.current[0] = el; }} hidden={step !== 0} className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-[19px] font-bold">Co poptáváte</h2>
        <div>
          <label className="label" htmlFor="category">Obor</label>
          <select className="field" id="category" name="category" required defaultValue={defaultCategory}>
            <option value="" disabled>Vyberte obor</option>
            {INQUIRY_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="title">Stručný název</label>
          <input className="field" id="title" name="title" required minLength={5} maxLength={120} placeholder="např. Zateplení fasády rodinného domu" />
        </div>
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <div>
            <label className="label" htmlFor="quantity">Rozsah (nepovinné)</label>
            <input className="field num" id="quantity" name="quantity" inputMode="decimal" placeholder="např. 500" />
          </div>
          <div>
            <label className="label" htmlFor="unit">Jednotka</label>
            <select className="field" id="unit" name="unit" defaultValue="m2">
              <option value="">—</option>
              {INQUIRY_UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">Popis práce</label>
          <textarea className="field min-h-32" id="description" name="description" required minLength={20} maxLength={3000}
            placeholder="Co je potřeba udělat, materiál, stav objektu, přístup (lešení, parkování)…" />
        </div>
        <PhotoPicker key={photoKey} folder={photosFolder} onBusy={setUploading} onFolder={(dir) => {
          setPhotosFolder(dir);
          // složka musí být v konceptu hned, ne až po další změně formuláře
          requestAnimationFrame(() => formRef.current && writeDraft(formRef.current));
        }} />
        <input type="hidden" name="photos_folder" value={photosFolder} />
      </section>

      <section ref={(el) => { sections.current[1] = el; }} hidden={step !== 1} className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-[19px] font-bold">Kde a kdy</h2>
        <div className="grid grid-cols-[1fr_7.5rem] gap-3">
          <div>
            <label className="label" htmlFor="city">Obec</label>
            <input className="field" id="city" name="city" required placeholder="např. Brno" autoComplete="address-level2" />
          </div>
          <div>
            <label className="label" htmlFor="zip">PSČ</label>
            <input className="field num" id="zip" name="zip" inputMode="numeric" placeholder="602 00" autoComplete="postal-code"
              onChange={(e) => { const r = regionFromZip(e.target.value); if (r && !regionTouched) setRegion(r); }} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="region">Kraj</label>
          <select className="field" id="region" name="region" required value={region}
            onChange={(e) => { setRegion(e.target.value); setRegionTouched(true); }}>
            <option value="" disabled>Vyberte kraj</option>
            {REGIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <p className="mt-1 text-[13px] text-muted">Podle kraje řemeslníci poptávky filtrují. Po zadání PSČ ho doplníme sami.</p>
        </div>
        <div>
          <label className="label" htmlFor="street">Ulice a číslo (nepovinné)</label>
          <input className="field" id="street" name="street" autoComplete="street-address" />
          <p className="mt-1 text-[13px] text-muted">Veřejně ukážeme jen obec a PSČ. Ulici uvidí jen ověření řemeslníci.</p>
        </div>
        <fieldset>
          <legend className="label">Termín realizace</legend>
          <div className="grid grid-cols-3 gap-2">
            {INQUIRY_TERMS.map(([v, l]) => (
              <label key={v} className="btn border border-line bg-white px-2 text-center has-checked:border-ink has-checked:bg-ink has-checked:text-white">
                <input type="radio" name="term" value={v} checked={term === v} onChange={() => setTerm(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        {term === "date" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="term_from">Zahájení</label>
              <input className="field num" id="term_from" name="term_from" type="date" min={today} value={termFrom} onChange={(e) => setTermFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="term_date">Dokončení</label>
              <input className="field num" id="term_date" name="term_date" type="date" min={termFrom || today} value={termDate} onChange={(e) => setTermDate(e.target.value)} />
            </div>
            <p className="col-span-2 text-[13px] text-muted">Stačí vyplnit jedno z dat.</p>
          </div>
        )}
      </section>

      <section ref={(el) => { sections.current[2] = el; }} hidden={step !== 2} className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-[19px] font-bold">Váš kontakt</h2>
          <p className="text-[14px] text-muted">Uvidí ho jen přihlášení řemeslníci s IČO ověřeným v ARES, nikoli veřejnost.</p>
        </div>
        <div>
          <label className="label" htmlFor="contact_name">Jméno a příjmení</label>
          <input className="field" id="contact_name" name="contact_name" required autoComplete="name" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact_phone">Telefon (doporučeno)</label>
            <input className="field num" id="contact_phone" name="contact_phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="777 123 456" />
          </div>
          <div>
            <label className="label" htmlFor="contact_email">E-mail</label>
            <input className="field" id="contact_email" name="contact_email" type="email" required autoComplete="email" />
          </div>
        </div>
        {/* Past na roboty – skryté pole, člověk ho nevyplní. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="web">Web</label>
          <input id="web" name="web" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="flex items-start gap-2.5 text-[14px] text-muted">
          <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-accent" required />
          <span>
            Souhlasím se zveřejněním poptávky a s tím, že můj kontakt uvidí řemeslníci s IČO ověřeným v ARES, kteří mě mohou kvůli poptávce kontaktovat.
            Více v <a href="/ochrana-osobnich-udaju#poptavky" target="_blank" rel="noreferrer" className="font-semibold text-accent-ink underline">zásadách ochrany osobních údajů</a>.
          </span>
        </label>
      </section>

      {state.error && <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn" role="alert">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && <button type="button" className="btn-ghost" onClick={() => go(step - 1)}>← Zpět</button>}
        {step < STEPS.length - 1
          ? <button type="button" className="btn-dark min-w-40" onClick={next}>Pokračovat</button>
          : <button className="btn-primary min-w-40" disabled={pending || uploading}>{pending ? "Odesílám…" : uploading ? "Nahrávám fotky…" : "Odeslat poptávku"}</button>}
      </div>
      {step === STEPS.length - 1
        ? <p className="text-[13px] text-muted">Na váš e-mail pošleme odkaz. Poptávka se zveřejní po jeho potvrzení a platí 60 dní.</p>
        : <p className="text-[13px] text-muted">Rozepsanou poptávku si pamatujeme v tomto prohlížeči, můžete se k ní vrátit.</p>}
    </form>
    </div>
  );
}
