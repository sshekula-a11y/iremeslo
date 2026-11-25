import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_BETAS, AI_MODEL, AiError, claude } from "./claude";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";

const CATEGORY_KEYS = EXPENSE_CATEGORIES.map(([k]) => k) as [string, ...string[]];

/** Co AI z účtenky vytáhne. Hodnoty, které na dokladu nejsou, vrací jako null. */
const ReceiptSchema = z.object({
  readable: z.boolean(),
  kind: z.enum(["receipt", "invoice"]),
  supplier_name: z.string(),
  supplier_ico: z.string().nullable(),
  doc_number: z.string().nullable(),
  issue_date: z.string().nullable(),
  total: z.number().nullable(),
  vat_base: z.number().nullable(),
  vat: z.number().nullable(),
  currency: z.string(),
  category: z.enum(CATEGORY_KEYS),
  description: z.string(),
  paid_method: z.enum(["card", "cash", "bank", "other"]),
  note: z.string(),
});
export type ReceiptData = z.infer<typeof ReceiptSchema>;

const SYSTEM = `You read Czech purchase receipts (účtenky, paragony) and received invoices (přijaté faktury) for a small Czech tradesman (řemeslník, OSVČ or s.r.o.) and extract bookkeeping data.

Rules:
- supplier_name: the seller's business name as printed (e.g. "HORNBACH Baumarkt CS spol. s r.o."), not the store slogan.
- supplier_ico: the seller's IČO (8 digits, pad with leading zeros if printed shorter). DIČ "CZ12345678" for a company contains the IČO after "CZ". null if not printed.
- issue_date: date of the purchase/issue as YYYY-MM-DD. Czech dates are day.month.year. null if not printed.
- total: the amount actually paid including VAT (Celkem / K úhradě / Součet), as a number. vat_base and vat: sums over all VAT rates if a VAT recap is printed, otherwise null.
- currency: ISO code, CZK unless another currency is clearly printed.
- kind: "invoice" for a faktura / daňový doklad with a buyer section, otherwise "receipt".
- category: material (building material, paint, tiles, cables…), subdodavky (work or services bought from others), phm (fuel), naradi (tools, machines, work clothes, protective gear), auto (car service, tyres, motorway vignette, parking, car wash), telefon (phone, internet), najem (rent, energy), pojisteni (insurance), reklama (ads, website, printing), kancelar (office supplies, software, accounting), jine (anything else).
- description: a short Czech summary of what was bought, max 80 characters (e.g. "Fasádní barva 2× 15 l, váleček").
- paid_method: card if a card payment / terminal slip is shown, cash if "hotově"/"hotovost", bank for an invoice payable by transfer, otherwise other.
- readable: false if the image is not a receipt/invoice or is too blurry to read the total; then fill other fields with best guesses or null.
- note: one short Czech sentence about anything the user should check (e.g. "Datum je špatně čitelné."), or an empty string.
Never invent values that are not on the document.`;

/** Přečte účtenku (obrázek JPEG/PNG/WEBP) nebo PDF faktury. */
export async function extractReceipt(bytes: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf") {
  const data = bytes.toString("base64");
  const doc = mediaType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data } };

  const response = await claude().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 8000,
    betas: AI_BETAS,
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ReceiptSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: [doc, { type: "text", text: "Extract the bookkeeping data from this document." }] }],
  });
  if (response.stop_reason === "refusal") throw new AiError("AI tento doklad nepřečetla. Zadejte údaje ručně.");
  const parsed = response.parsed_output;
  if (!parsed) throw new AiError("AI doklad nepřečetla. Zkuste ostřejší fotku, nebo údaje zadejte ručně.");
  return { value: parsed, usage: response.usage, model: response.model };
}
