"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, PHOTO_BUCKET, photoUrl, randomFileName, shrinkPhoto } from "@/lib/inquiry-photos";

type Photo = { name: string; url: string; uploading?: boolean };

/**
 * Fotky k poptávce: nahrávají se hned po výběru (odeslání formuláře je pak rychlé).
 * Do formuláře jde jen složka (photos_folder); fotky v ní dohledá databáze.
 */
export function PhotoPicker({ folder, onFolder, onBusy }: { folder: string; onFolder: (f: string) => void; onBusy: (b: boolean) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = photos.some((p) => p.uploading);

  useEffect(() => { onBusy(busy); }, [busy, onBusy]);

  // Obnovený koncept: fotky z rozpracované složky dohledáme v úložišti.
  useEffect(() => {
    if (!folder) return;
    let cancelled = false;
    createClient().storage.from(PHOTO_BUCKET).list(folder, { limit: MAX_PHOTOS, sortBy: { column: "created_at", order: "asc" } }).then(({ data }) => {
      if (cancelled || !data) return;
      setPhotos((cur) => (cur.length ? cur : data.filter((o) => o.name !== ".emptyFolderPlaceholder").map((o) => ({ name: `${folder}/${o.name}`, url: photoUrl(`${folder}/${o.name}`) }))));
    });
    return () => { cancelled = true; };
  }, [folder]);

  const add = async (files: FileList | null) => {
    setError(null);
    if (!files?.length) return;
    const free = MAX_PHOTOS - photos.length;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, free);
    if (files.length > free) setError(`Přidat jde nejvýš ${MAX_PHOTOS} fotek.`);
    if (!list.length) return;
    const dir = folder || crypto.randomUUID();
    if (!folder) onFolder(dir);
    const db = createClient();
    for (const file of list) {
      const name = `${dir}/${randomFileName()}`;
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { name, url: preview, uploading: true }]);
      try {
        const blob = await shrinkPhoto(file);
        const { error: e } = await db.storage.from(PHOTO_BUCKET).upload(name, blob, { contentType: "image/jpeg", upsert: false });
        if (e) throw e;
        setPhotos((p) => p.map((x) => (x.name === name ? { name, url: preview } : x)));
      } catch {
        setPhotos((p) => p.filter((x) => x.name !== name));
        setError("Fotku se nepodařilo nahrát. Zkuste jinou nebo menší.");
      }
    }
    if (input.current) input.current.value = "";
  };

  const remove = async (name: string) => {
    setPhotos((p) => p.filter((x) => x.name !== name));
    await createClient().storage.from(PHOTO_BUCKET).remove([name]);
  };

  return (
    <div>
      <p className="label">Fotky (nepovinné, nejvýš {MAX_PHOTOS})</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((p) => (
          <div key={p.name} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element -- náhled z prohlížeče / veřejného úložiště */}
            <img src={p.url} alt="" className={`h-full w-full object-cover ${p.uploading ? "opacity-50" : ""}`} />
            {p.uploading ? (
              <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-0.5 text-center text-[11px] text-white">Nahrávám…</span>
            ) : (
              <button type="button" onClick={() => remove(p.name)} aria-label="Odebrat fotku"
                className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-ink/75 text-[16px] leading-none text-white hover:bg-ink">×</button>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button type="button" onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-white text-[13px] font-semibold text-muted hover:border-ink/40 hover:text-ink">
            <span className="text-[22px] leading-none" aria-hidden="true">+</span>Přidat
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Vybrat fotky" onChange={(e) => add(e.target.files)} />
      {error && <p className="mt-1 text-[13px] font-medium text-warn" role="alert">{error}</p>}
      <p className="mt-1 text-[13px] text-muted">
        Fotky uvidí všichni u zveřejněné poptávky. Nefoťte osoby, SPZ ani čísla domů. Údaje o poloze z fotek odstraníme.
      </p>
    </div>
  );
}
