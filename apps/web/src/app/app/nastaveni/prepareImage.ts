/**
 * Úprava obrázku v prohlížeči před nahráním:
 *  - zmenšení (fotka z telefonu má klidně 5 MB),
 *  - u razítka a podpisu odstranění bílého papíru (průhledné pozadí) a ořez na obsah,
 *    aby na faktuře nebyl vidět šedý obdélník fotky.
 */

const MAX_BYTES = 1024 * 1024;

export interface Prepared { blob: Blob; ext: "png" | "jpg" }

export async function prepareImage(file: File, opts: { removeBackground: boolean }): Promise<Prepared> {
  const bitmap = await createImageBitmap(file); // respektuje otočení z EXIF
  const maxSide = opts.removeBackground ? 1000 : 1200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  let canvas = draw(bitmap, Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  bitmap.close();

  if (opts.removeBackground) {
    canvas = whiteToTransparent(canvas);
    return { blob: await shrinkPng(canvas), ext: "png" };
  }
  // Logo: PNG zachová průhlednost; fotku (JPEG) necháme jako JPEG.
  if (file.type === "image/png") return { blob: await shrinkPng(canvas), ext: "png" };
  return { blob: await toBlob(canvas, "image/jpeg", 0.88), ext: "jpg" };
}

function draw(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * Papír zprůhlední, inkoust nechá. Jas papíru se odhaduje zvlášť pro každé místo fotky
 * (nejsvětlejší bod v okolí), takže stín nebo nerovnoměrné světlo nezůstane jako šedá skvrna.
 * Nakonec ořízne prázdné okraje.
 */
function whiteToTransparent(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext("2d")!;
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) lum[p] = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;

  // Mapa jasu papíru: maximum v blocích, vyhlazené se sousedy, mezi bloky plynule (bilineárně).
  const B = 24;
  const bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  const raw = new Float32Array(bw * bh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = ((y / B) | 0) * bw + ((x / B) | 0);
    const l = lum[y * w + x]!;
    if (l > raw[j]!) raw[j] = l;
  }
  const bg = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    // Maximum ze sousedů (blok celý pokrytý razítkem si vezme papír vedle), pak průměr – hladší přechody.
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = by + dy, xx = bx + dx;
      if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) best = Math.max(best, raw[yy * bw + xx]!);
    }
    bg[by * bw + bx] = (best + raw[by * bw + bx]!) / 2;
  }
  const paperAt = (x: number, y: number) => {
    const fx = Math.min(bw - 1, Math.max(0, x / B - 0.5)), fy = Math.min(bh - 1, Math.max(0, y / B - 0.5));
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(bw - 1, x0 + 1), y1 = Math.min(bh - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const top = bg[y0 * bw + x0]! * (1 - tx) + bg[y0 * bw + x1]! * tx;
    const bot = bg[y1 * bw + x0]! * (1 - tx) + bg[y1 * bw + x1]! * tx;
    return top * (1 - ty) + bot * ty;
  };

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    const diff = paperAt(x, y) - lum[p]!; // o kolik je bod tmavší než papír kolem něj
    const alpha = diff <= 22 ? 0 : diff >= 75 ? 255 : Math.round(((diff - 22) / 53) * 255);
    d[p * 4 + 3] = alpha;
    if (alpha > 60) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (maxX < 0) throw new Error("Na fotografii jsme nenašli razítko ani podpis. Vyfoťte je zblízka na bílém papíře.");

  const pad = 8;
  const x = Math.max(0, minX - pad), y = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - x, ch = Math.min(h, maxY + pad + 1) - y;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(c, x, y, cw, ch, 0, 0, cw, ch);
  return out;
}

async function shrinkPng(c: HTMLCanvasElement): Promise<Blob> {
  let canvas = c;
  for (let i = 0; i < 5; i++) {
    const blob = await toBlob(canvas, "image/png");
    if (blob.size <= MAX_BYTES) return blob;
    canvas = draw(canvas, Math.round(canvas.width * 0.75), Math.round(canvas.height * 0.75));
  }
  throw new Error("Obrázek se nepodařilo zmenšit pod 1 MB.");
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Obrázek se nepodařilo zpracovat."))), type, quality));
}
