"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignatureDialog } from "@/components/SignatureDialog";
import { cancelSignLink, createSignLink, signDocument } from "./sign-action";

type Side = "supplier" | "customer";
export interface SignSlot { side: Side; label: string; defaultName: string; signed: { name: string; at: string } | null }
export interface SignLinkStatus { state: "active" | "signed" | "canceled" | "expired"; sentTo: string | null; expires: string; opened: string | null }

/** Podpisy dokladu: stav obou stran, podpis prstem tady na místě, nebo odkaz zákazníkovi na dálku. */
export function SignPanel({ documentId, docTitle, slots, defaultPlace, customerEmail, link }: {
  documentId: string; docTitle: string; slots: SignSlot[]; defaultPlace: string; customerEmail: string; link: SignLinkStatus | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<SignSlot | null>(null);
  const [remote, setRemote] = useState(false);
  const allSigned = slots.every((s) => s.signed);
  const customer = slots.find((s) => s.side === "customer");

  return (
    <section className="card space-y-3 p-4" aria-labelledby="podpisy">
      <div>
        <h2 id="podpisy" className="font-semibold">Podpis prstem</h2>
        <p className="text-[14px] text-muted">
          {allSigned ? "Doklad je podepsaný oběma stranami. Podpisy jsou v náhledu i v PDF." : "Podepište tady na telefonu nebo tabletu, nebo pošlete zákazníkovi odkaz a podepíše na svém telefonu."}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {slots.map((s) => (
          <li key={s.side} className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-[10px] bg-paper px-3 py-2 ring-1 ring-line">
            <div className="min-w-0">
              <p className="text-[13px] text-muted">{s.label}</p>
              {s.signed ? <p className="truncate font-semibold text-ok">✓ {s.signed.name} <span className="font-normal text-muted">· {s.signed.at}</span></p>
                : s.side === "customer" && link?.state === "active" ? <p className="font-semibold">Čeká na podpis přes odkaz</p>
                : <p className="font-semibold">Nepodepsáno</p>}
            </div>
            {!s.signed && (
              <div className="flex gap-2">
                <button type="button" className="btn-dark min-h-10 shrink-0 px-3 text-[14px]" onClick={() => setOpen(s)}>Podepsat zde</button>
                {s.side === "customer" && !remote && (
                  <button type="button" className="btn-ghost min-h-10 shrink-0 px-3 text-[14px]" onClick={() => setRemote(true)}>Poslat odkaz</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {customer && !customer.signed && link?.state === "active" && !remote && (
        <p className="text-[14px] text-muted">
          Odkaz {link.sentTo ? <>poslaný na <strong className="text-ink">{link.sentTo}</strong> </> : ""}platí do {link.expires}.
          {link.opened ? ` Zákazník ho otevřel ${link.opened}.` : " Zákazník ho zatím neotevřel."}{" "}
          <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={() => setRemote(true)}>Poslat znovu</button>
          {" · "}
          <CancelLink documentId={documentId} />
        </p>
      )}

      {customer && !customer.signed && remote && (
        <RemoteLink documentId={documentId} docTitle={docTitle} defaultEmail={customerEmail} hadLink={link?.state === "active"} onClose={() => { setRemote(false); router.refresh(); }} />
      )}

      {open && (
        <SignatureDialog
          title={`Podpis – ${open.label.toLowerCase()}`}
          defaultName={open.defaultName}
          defaultPlace={defaultPlace}
          onSubmit={(name, place, png) => signDocument(documentId, open.side, name, place, png)}
          onClose={() => setOpen(null)}
          onDone={() => { setOpen(null); router.refresh(); }}
        />
      )}
    </section>
  );
}

function CancelLink({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="font-semibold text-warn hover:underline" disabled={pending}
      onClick={() => start(async () => { await cancelSignLink(documentId); router.refresh(); })}>
      {pending ? "Ruším…" : "Zrušit odkaz"}
    </button>
  );
}

/** Vytvoří odkaz k podpisu: pošle ho e-mailem, nebo ho řemeslník zkopíruje či sdílí (SMS, WhatsApp…). */
function RemoteLink({ documentId, docTitle, defaultEmail, hadLink, onClose }: { documentId: string; docTitle: string; defaultEmail: string; hadLink: boolean; onClose: () => void }) {
  const [email, setEmail] = useState(defaultEmail);
  const [url, setUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare] = useState(() => typeof navigator !== "undefined" && "share" in navigator);
  const [pending, start] = useTransition();
  const message = (u: string) => `Dobrý den, posílám ${docTitle} k podpisu. Otevřete odkaz v telefonu a podepište prstem: ${u}`;

  const create = (withEmail: boolean) => {
    setError(null); setInfo(null);
    start(async () => {
      const res = await createSignLink(documentId, withEmail ? email : "");
      if (!res.ok) { setError(res.error); return; }
      setUrl(res.link);
      setInfo(withEmail ? (res.emailed ? `Odkaz jsme poslali na ${email.trim()}.` : "E-mail se nepodařilo odeslat – pošlete odkaz jinak (SMS, WhatsApp).") : null);
    });
  };
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError("Odkaz se nepodařilo zkopírovat – označte ho a zkopírujte ručně."); }
  };
  const share = async () => {
    if (!url) return;
    try { await navigator.share({ title: docTitle, text: message(url) }); } catch { /* zrušeno */ }
  };

  return (
    <div className="space-y-3 rounded-[10px] bg-paper p-3 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">Podpis na dálku</p>
        <button type="button" className="text-[14px] text-muted hover:text-ink" onClick={onClose}>Zavřít</button>
      </div>
      {!url ? (
        <>
          <p className="text-[14px] text-muted">
            Zákazník dostane odkaz, listinu si přečte a podepíše prstem na svém telefonu – bez registrace. Odkaz platí 14 dní a jde použít jednou. Až podepíše, přijde vám e-mail.
            {hadLink && " Dřívější odkaz tím přestane platit."}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <label className="label" htmlFor="sign-email">E-mail zákazníka</label>
              <input id="sign-email" type="email" inputMode="email" autoComplete="off" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="zakaznik@email.cz" />
            </div>
            <button type="button" className="btn-primary" disabled={pending || !email.trim()} onClick={() => create(true)}>{pending ? "Posílám…" : "Poslat e-mailem"}</button>
          </div>
          <button type="button" className="text-[14px] font-semibold text-accent-ink hover:underline" disabled={pending} onClick={() => create(false)}>
            Jen vytvořit odkaz (pošlu ho SMS nebo WhatsAppem)
          </button>
        </>
      ) : (
        <>
          {info && <p role="status" className="text-[14px] font-semibold text-ok">{info}</p>}
          <div>
            <label className="label" htmlFor="sign-url">Odkaz k podpisu</label>
            <input id="sign-url" readOnly className="field num text-[13px]" value={url} onFocus={(e) => e.target.select()} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-dark min-h-10 px-3 text-[14px]" onClick={copy}>{copied ? "Zkopírováno ✓" : "Kopírovat odkaz"}</button>
            <a className="btn-ghost min-h-10 px-3 text-[14px]" href={`sms:?&body=${encodeURIComponent(message(url))}`}>Poslat SMS</a>
            <a className="btn-ghost min-h-10 px-3 text-[14px]" href={`https://wa.me/?text=${encodeURIComponent(message(url))}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            {canShare && <button type="button" className="btn-ghost min-h-10 px-3 text-[14px]" onClick={share}>Sdílet…</button>}
          </div>
          <p className="text-[13px] text-muted">Odkaz si uložte teď – z bezpečnostních důvodů ho později znovu nezobrazíme (můžete ale vytvořit nový).</p>
        </>
      )}
      {error && <p role="alert" className="rounded-[10px] bg-warn-soft px-3 py-2 text-[14px] text-warn">{error}</p>}
    </div>
  );
}
