import "server-only";
import type { TextItem } from "./pdf-import";

/** Textové položky PDF (pdf.js na serveru). `pages` = kolik stran číst (faktura má údaje obvykle na první). */
export async function pdfText(bytes: Uint8Array, pages = 1): Promise<TextItem[][]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes, useSystemFonts: false, disableFontFace: true });
  try {
    const doc = await task.promise;
    const out: TextItem[][] = [];
    for (let n = 1; n <= Math.min(pages, doc.numPages); n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      out.push(tc.items.flatMap((i) => ("str" in i ? [{ str: i.str, x: i.transform[4] as number, y: i.transform[5] as number, w: i.width }] : [])));
    }
    return out;
  } finally {
    await task.destroy();
  }
}
