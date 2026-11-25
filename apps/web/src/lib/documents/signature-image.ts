/** Kontrola podpisu prstem z prohlížeče: PNG jako data URL rozumné velikosti a jméno podepisujícího. */
const PNG_PREFIX = "data:image/png;base64,";
const MAX_BYTES = 280_000;

export function cleanSignatureImage(image: string): string | null {
  if (typeof image !== "string" || !image.startsWith(PNG_PREFIX)) return null;
  const bytes = Buffer.from(image.slice(PNG_PREFIX.length), "base64");
  if (bytes.length < 100 || bytes.length > MAX_BYTES || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return PNG_PREFIX + bytes.toString("base64");
}

export function cleanSignerName(name: string): string | null {
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  return n.length >= 2 && n.length <= 120 ? n : null;
}

export const cleanPlace = (place: string) => String(place ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
