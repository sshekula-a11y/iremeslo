/**
 * Peníze a množství jako celá čísla, nikdy float.
 *
 * - Částka (Money) = celé haléře (1 Kč = 100).
 * - Množství (Qty) = setiny jednotky (1,5 m² = 150), zadání chce 2 desetinná místa.
 * - Sazba DPH = celá procenta (21, 12, 0).
 * - Procenta slevy a marže = setiny procenta / basis points (12,5 % = 1250).
 *
 * Mezivýpočty běží v BigInt, aby násobení velkých čísel nepřeteklo
 * (Number je bezpečný jen do 2^53).
 */

export type Money = number; // haléře, celé číslo
export type Qty = number; // setiny jednotky, celé číslo
export type BasisPoints = number; // setiny procenta, celé číslo

export function assertInt(n: number, what: string): void {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${what} musí být celé číslo, dostal jsem ${n}`);
  }
}

/** round(a * b / d), zaokrouhlení „půl nahoru“ od nuly (obchodní zaokrouhlení). */
export function mulDivRound(a: number, b: number, d: number): number {
  assertInt(a, "a");
  assertInt(b, "b");
  assertInt(d, "d");
  if (d === 0) throw new RangeError("dělení nulou");
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(d);
  const neg = num < 0n !== den < 0n;
  const an = num < 0n ? -num : num;
  const ad = den < 0n ? -den : den;
  const q = (an * 2n + ad) / (ad * 2n);
  const r = neg ? -q : q;
  const out = Number(r);
  if (!Number.isSafeInteger(out)) throw new RangeError("výsledek je mimo rozsah");
  return out;
}

/** Kč → haléře z čísla s nejvýš 2 desetinnými místy, např. kc(2500) nebo kc(12.5). */
export function kc(value: number): Money {
  const h = Math.round(value * 100);
  if (Math.abs(h - value * 100) > 1e-6) {
    throw new RangeError(`částka ${value} má víc než 2 desetinná místa`);
  }
  return h;
}

/** Množství z čísla s nejvýš 2 desetinnými místy, např. q(180) nebo q(1.25). */
export function q(value: number): Qty {
  const v = Math.round(value * 100);
  if (Math.abs(v - value * 100) > 1e-6) {
    throw new RangeError(`množství ${value} má víc než 2 desetinná místa`);
  }
  return v;
}

/** Celková cena řádku = množství × cena za jednotku, zaokrouhleno na haléře. */
export function lineTotal(qty: Qty, unitPrice: Money): Money {
  return mulDivRound(qty, unitPrice, 100);
}

/** Zaokrouhlení na celé koruny (pro „celkem k úhradě“). */
export function roundToCrowns(amount: Money): Money {
  return mulDivRound(amount, 1, 100) * 100;
}

/** Text pro češtinu: 65184 Kč → "65 184,00 Kč". */
export function formatCzk(amount: Money, opts: { withCurrency?: boolean } = {}): string {
  assertInt(amount, "částka");
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100).toString();
  const cents = (abs % 100).toString().padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const s = `${neg ? "−" : ""}${grouped},${cents}`;
  return opts.withCurrency === false ? s : `${s} Kč`;
}

/** Procento z basis points: 3918 → "39,2 %". */
export function formatPercent(bp: BasisPoints, decimals = 1): string {
  const value = mulDivRound(bp, 10 ** decimals, 100) / 10 ** decimals;
  return `${value.toFixed(decimals).replace(".", ",")} %`;
}

/** Částka pro strojové formáty (SPAYD, ISDOC): 6518400 → "65184.00". */
export function toDecimalString(amount: Money): string {
  assertInt(amount, "částka");
  const neg = amount < 0;
  const abs = Math.abs(amount);
  return `${neg ? "-" : ""}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

/** Rozdělí částku v poměru vah tak, aby součet seděl na haléř (metoda největších zbytků). */
export function allocate(total: Money, weights: number[]): Money[] {
  assertInt(total, "částka");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum === 0) {
    const out: Money[] = weights.map(() => 0);
    out[0] = total;
    return out;
  }
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const parts = weights.map((w) => {
    const exact = (BigInt(abs) * BigInt(w)) / BigInt(sum);
    const rem = (BigInt(abs) * BigInt(w)) % BigInt(sum);
    return { base: Number(exact), rem };
  });
  let left = abs - parts.reduce((a, p) => a + p.base, 0);
  const order = parts
    .map((p, i) => ({ i, rem: p.rem }))
    .sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i));
  const out = parts.map((p) => p.base);
  for (const o of order) {
    if (left <= 0) break;
    out[o.i] = (out[o.i] ?? 0) + 1;
    left--;
  }
  return out.map((v) => v * sign);
}
