"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setBrandImage, type BrandImage } from "./actions";

const MAX_BYTES = 1024 * 1024;

/** Nahrání loga, razítka nebo podpisu. PNG nebo JPG (to umí i PDF), nejvýš 1 MB. */
export function ImageSlot({ companyId, kind, label, hint, url, canEdit }: {
  companyId: string; kind: BrandImage; label: string; hint: string; url: string | null; canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : null;
    if (!ext) return setError("Nahrajte obrázek PNG nebo JPG.");
    if (file.size > MAX_BYTES) return setError("Obrázek je větší než 1 MB.");
    startBusy(async () => {
      const path = `${companyId}/brand/${kind}-${Date.now().toString(36)}.${ext}`;
      const { error: upErr } = await createClient().storage.from("files").upload(path, file, { contentType: file.type, upsert: false });
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

  return (
    <div className="rounded-xl border border-line p-3">
      <p className="font-semibold">{label}</p>
      <p className="mb-2 text-[13px] text-muted">{hint}</p>
      <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-paper">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="max-h-20 max-w-[90%] object-contain" />
        ) : (
          <span className="text-[13px] text-muted">Nenahráno</span>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label={`${label} – soubor`}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
          <button type="button" className="btn-ghost min-h-9 px-3 text-[14px]" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Ukládám…" : url ? "Změnit" : "Nahrát"}
          </button>
          {url && <button type="button" className="text-[13px] text-muted underline hover:text-warn" disabled={busy} onClick={remove}>Odebrat</button>}
        </div>
      )}
      {error && <p className="mt-1 text-[13px] font-medium text-warn" role="alert">{error}</p>}
    </div>
  );
}
