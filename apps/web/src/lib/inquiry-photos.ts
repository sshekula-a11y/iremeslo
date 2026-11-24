import { SUPABASE_URL } from "@/lib/supabase/config";

/** Fotky k poptávce: veřejné úložiště inquiry-photos/<složka>/<soubor> (migrace 020). */
export const PHOTO_BUCKET = "inquiry-photos";
export const MAX_PHOTOS = 6;

export function photoUrl(name: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${name.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Zmenší fotku v prohlížeči (delší strana nejvýš 1600 px) a uloží ji znovu jako JPEG.
 * Tím zmizí i údaje z EXIF – včetně polohy GPS, kde byla fotka pořízena.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // respektuje otočení z EXIF
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Fotku se nepodařilo zpracovat."))), "image/jpeg", 0.82));
}

export function randomFileName(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("") + ".jpg";
}
