// Zkopíruje soubory pro čtení účtenek z fotky (Tesseract) do public/ocr, aby se nestahovaly z cizího CDN.
// Spouští ho next.config.ts, takže proběhne při `next build` i `next dev` bez ohledu na to, kdo build spouští.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const out = join(dirname(new URL(import.meta.url).pathname), "..", "public", "ocr");
mkdirSync(out, { recursive: true });
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

const files = [
  [join(pkgDir("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]
    .map((f) => [join(pkgDir("tesseract.js-core"), f), f]),
  [join(pkgDir("@tesseract.js-data/ces"), "4.0.0_best_int", "ces.traineddata.gz"), "ces.traineddata.gz"],
];
for (const [from, to] of files) {
  if (!existsSync(from)) throw new Error(`Chybí ${from}`);
  copyFileSync(from, join(out, to));
}
console.log(`OCR: ${files.length} souborů v public/ocr`);
