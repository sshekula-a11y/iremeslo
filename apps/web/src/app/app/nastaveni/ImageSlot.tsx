"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setBrandImage, type BrandImage } from "./actions";
import { prepareImage } from "./prepareImage";

/**
 * Logo, razítko s podpisem, nebo samotný podpis. Jde vyfotit rovnou telefonem:
 * fotka se v prohlížeči zmenší a u razítka a podpisu se odstraní bílý papír.
 */
export function ImageSlot({ companyId, kind, label, hint, url, canEdit }: {
  companyId: string; kind: BrandImage; label: string; hint: string; url: string | null; canEdit: boolean;
}) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const removeBackground = kind !== "logo";

  function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Vyberte obrázek nebo fotku.");
    startBusy(async () => {
      let prepared;
      try {
        prepared = await prepareImage(file, { removeBackground });
      } catch (e) {
        return setError(e instanceof Error ? e.message : "Obrázek se nepodařilo zpracovat.");
      }
      const path = `${companyId}/brand/${kind}-${Date.now().toString(36)}.${prepared.ext}`;
      const contentType = prepared.ext === "png" ? "image/png" : "image/jpeg";
      const { error: upErr } = await createClient().storage.from("files").upload(path, prepared.blob, { contentType, upsert: false });
      if (upErr) return setError("Nahrání se nepovedlo.");
      const res = await setBrandImage(kind, path);
      if (res.error) return setError(res.error);
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startBusy(async () => {
      const res = await setBrandImage(kind, null);
      if (res.error) return setError(res.error);
      router.refresh();
    });
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) upload(f);
  };

  return (
    <div className="rounded-xl border border-line p-3">
      <p className="font-semibold">{label}</p>
      <p className="mb-2 text-[13px] text-muted">{hint}</p>
      <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-white bg-[linear-gradient(45deg,#f4f6f9_25%,transparent_25%,transparent_75%,#f4f6f9_75%),linear-gradient(45deg,#f4f6f9_25%,transparent_25%,transparent_75%,#f4f6f9_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] ring-1 ring-line">
        {busy ? (
          <span className="text-[13px] text-muted">Upravuji a nahrávám…</span>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="max-h-20 max-w-[90%] object-contain" />
        ) : (
          <span className="text-[13px] text-muted">Nenahráno</span>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`${label} – vyfotit`} onChange={onPick} />
          <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/heic" className="sr-only" aria-label={`${label} – soubor`} onChange={onPick} />
          {removeBackground && (
            <button type="button" className="btn-dark min-h-9 px-3 text-[14px]" disabled={busy} onClick={() => camera.current?.click()}>Vyfotit</button>
          )}
          <button type="button" className="btn-ghost min-h-9 px-3 text-[14px]" disabled={busy} onClick={() => picker.current?.click()}>
            {removeBackground ? "Ze souboru" : url ? "Změnit" : "Nahrát"}
          </button>
          {url && <button type="button" className="text-[13px] text-muted underline hover:text-warn" disabled={busy} onClick={remove}>Odebrat</button>}
        </div>
      )}
      {error && <p className="mt-1 text-[13px] font-medium text-warn" role="alert">{error}</p>}
    </div>
  );
}
