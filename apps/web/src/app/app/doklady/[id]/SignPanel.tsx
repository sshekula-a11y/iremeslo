"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signDocument } from "./sign-action";

type Side = "supplier" | "customer";
export interface SignSlot { side: Side; label: string; defaultName: string; signed: { name: string; at: string } | null }

/** Podpisy dokladu: stav obou stran a tlačítko, které otevře plochu pro podpis prstem. */
export function SignPanel({ documentId, slots, defaultPlace }: { documentId: string; slots: SignSlot[]; defaultPlace: string }) {
  const [open, setOpen] = useState<SignSlot | null>(null);
  const allSigned = slots.every((s) => s.signed);

  return (
    <section className="card space-y-3 p-4" aria-labelledby="podpisy">
      <div>
        <h2 id="podpisy" className="font-semibold">Podpis prstem</h2>
        <p className="text-[14px] text-muted">
          {allSigned ? "Doklad je podepsaný oběma stranami. Podpisy jsou v náhledu i v PDF." : "Podepište na telefonu nebo tabletu – podpis se vloží do dokladu i do PDF."}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {slots.map((s) => (
          <li key={s.side} className="flex min-h-14 items-center justify-between gap-3 rounded-[10px] bg-paper px-3 py-2 ring-1 ring-line">
            <div className="min-w-0">
              <p className="text-[13px] text-muted">{s.label}</p>
              {s.signed ? <p className="truncate font-semibold text-ok">✓ {s.signed.name} <span className="font-normal text-muted">· {s.signed.at}</span></p> : <p className="font-semibold">Nepodepsáno</p>}
            </div>
            {!s.signed && <button type="button" className="btn-dark min-h-10 shrink-0 px-3 text-[14px]" onClick={() => setOpen(s)}>Podepsat</button>}
          </li>
        ))}
      </ul>
      {open && <SignDialog documentId={documentId} slot={open} defaultPlace={defaultPlace} onClose={() => setOpen(null)} />}
    </section>
  );
}

const INK = "#1b2a5e";

function SignDialog({ documentId, slot, defaultPlace, onClose }: { documentId: string; slot: SignSlot; defaultPlace: string; onClose: () => void }) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const box = useRef({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const [inked, setInked] = useState(false);
  const [name, setName] = useState(slot.defaultName);
  const [place, setPlace] = useState(defaultPlace);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 2.6;
    box.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    setInked(false);
  }, []);

  useEffect(() => {
    setup();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // otočení telefonu změní velikost plochy – začneme znovu, jinak by se podpis zdeformoval
    window.addEventListener("resize", setup);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); window.removeEventListener("resize", setup); };
  }, [setup, onClose]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mark = (p: { x: number; y: number }) => {
    const b = box.current;
    b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y); b.maxX = Math.max(b.maxX, p.x); b.maxY = Math.max(b.maxY, p.y);
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    mark(p);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      const pressure = ev.pointerType === "pen" && ev.pressure > 0 ? ev.pressure : 0.5;
      ctx.lineWidth = 1.6 + pressure * 2.2;
      ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last.current = p;
      mark(p);
    }
    const b = box.current;
    if (!inked && b.maxX - b.minX + (b.maxY - b.minY) > 40) setInked(true);
  };
  const up = () => { drawing.current = false; last.current = null; };

  /** Ořízne podpis na jeho obrys (s okrajem) a zmenší na nejvýš 600 px – PNG pak má desítky kB. */
  const exportPng = (): string | null => {
    const c = canvas.current;
    const b = box.current;
    if (!c || !Number.isFinite(b.minX)) return null;
    const dpr = c.width / c.getBoundingClientRect().width;
    const pad = 8;
    const sx = Math.max(0, (b.minX - pad) * dpr), sy = Math.max(0, (b.minY - pad) * dpr);
    const sw = Math.min(c.width - sx, (b.maxX - b.minX + pad * 2) * dpr), sh = Math.min(c.height - sy, (b.maxY - b.minY + pad * 2) * dpr);
    const scale = Math.min(1, 600 / sw, 240 / sh);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext("2d")!.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  };

  const submit = () => {
    setError(null);
    if (!inked) return setError("Podepište se prstem do plochy.");
    if (name.trim().length < 2) return setError("Vyplňte jméno a příjmení podepisujícího.");
    if (!agree) return setError("Potvrďte, že podepisující souhlasí s obsahem dokladu.");
    const png = exportPng();
    if (!png) return setError("Podpis se nepodařilo načíst. Zkuste to znovu.");
    start(async () => {
      const res = await signDocument(documentId, slot.side, name, place, png);
      if (!res.ok) { setError(res.error); return; }
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sign-title">
      <div className="flex w-full max-w-2xl flex-col gap-3 overflow-y-auto bg-white p-4 sm:rounded-[14px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sign-title" className="font-display text-[20px] font-extrabold">Podpis – {slot.label.toLowerCase()}</h2>
            <p className="text-[14px] text-muted">Podepište se prstem nebo perem do bílé plochy. Na telefonu je pohodlnější ho otočit na šířku.</p>
          </div>
          <button type="button" className="btn-ghost min-h-10 px-3" onClick={onClose} aria-label="Zavřít">✕</button>
        </div>

        <div className="relative">
          <canvas
            ref={canvas}
            className="block h-[220px] w-full touch-none rounded-[10px] bg-white ring-2 ring-line sm:h-[260px]"
            style={{ cursor: "crosshair" }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
            aria-label="Plocha pro podpis prstem"
          />
          <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-ink/30" aria-hidden="true" />
          {!inked && <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[15px] text-muted/70">Podepište se zde</p>}
          <button type="button" className="btn-ghost absolute right-2 top-2 min-h-9 bg-white/90 px-3 text-[14px]" onClick={setup}>Smazat</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sign-name">Jméno a příjmení podepisujícího</label>
            <input id="sign-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="sign-place">Místo podpisu</label>
            <input id="sign-place" className="field" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-[14px]">
          <input type="checkbox" className="mt-1 size-4" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(null); }} />
          <span>Podepisující se s dokladem seznámil a souhlasí s jeho obsahem. Podpis se uloží s časem a otiskem dokladu a nejde ho později změnit.</span>
        </label>
        {error && <p role="alert" className="rounded-[10px] bg-warn-soft px-3 py-2 text-[14px] text-warn">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Zrušit</button>
          <button type="button" className="btn-primary" disabled={pending} onClick={submit}>{pending ? "Ukládám…" : "Potvrdit podpis"}</button>
        </div>
      </div>
    </div>
  );
}
