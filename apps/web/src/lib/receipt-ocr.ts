/**
 * Čtení účtenky z fotky přímo v prohlížeči – bez AI a bez posílání fotky třetím stranám.
 *  1) QR Platba (na fakturách): přesná částka a datum splatnosti,
 *  2) rozpoznání textu (Tesseract, čeština): text pak rozebere parseReceiptText na serveru.
 * Knihovny se načtou až při prvním použití (poprvé se stáhne asi 6 MB z našeho webu, pak je to v mezipaměti prohlížeče).
 */
import { parseSpaydText } from "@iremeslo/core";

async function toCanvas(blob: Blob, maxSide: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  c.getContext("2d", { willReadFrequently: true })!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

/** QR Platba z fotky (vrátí null, když na fotce není). */
export async function scanPaymentQr(blob: Blob): Promise<ReturnType<typeof parseSpaydText>> {
  try {
    const { default: jsQR } = await import("jsqr");
    const c = await toCanvas(blob, 1600);
    const img = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
    return code ? parseSpaydText(code.data) : null;
  } catch {
    return null;
  }
}

/** Úprava fotky pro rozpoznání textu: odstíny šedi a vyšší kontrast (termo účtenky bývají bledé). */
function enhance(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - min) / range) * 255 * 1.15 - 20));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Text z fotky (čeština). `onProgress` dostává 0–100. */
export async function recognizeText(blob: Blob, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  // Soubory jsou na našem webu (public/ocr), ne na cizím CDN; jazyková data si prohlížeč uloží do mezipaměti.
  const worker = await createWorker("ces", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(30 + m.progress * 70));
      else if (m.status.includes("loading")) onProgress?.(Math.round(m.progress * 30));
    },
  });
  try {
    const c = enhance(await toCanvas(blob, 2200));
    const { data } = await worker.recognize(c);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}
