import type { IntradayInstrument } from "./intraday-scope";

export type SymbolLookup =
  | { state: "idle" }
  | { state: "resolved"; instrument: IntradayInstrument }
  | { state: "unknown"; code: string; suggestions: IntradayInstrument[] };

/**
 * Normalizes a typed instrument code into the shape used by the trusted feed:
 * uppercase, without separators or venue suffixes, and zero padded to the four
 * digit Hong Kong board-lot convention so `700`, `0700` and `0700.HK` all reach
 * the same trusted instrument.
 */
export function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "").replace(/^(HK|HKG|SEHK)[.:]/, "").replace(/[.:](HK|HKG|SEHK)$/, "").replace(/^\$/, "");
  if (cleaned.length === 0) return "";
  if (/^\d+$/.test(cleaned)) return cleaned.replace(/^0+(?=\d)/, "").padStart(4, "0");
  return cleaned;
}

/** Every string a visitor may reasonably type to reach one instrument. */
export function instrumentAliases(instrument: IntradayInstrument): string[] {
  return [normalizeCode(instrument.symbol), instrument.label.toUpperCase(), ...(instrument.meta ? [instrument.meta.split("·")[0].trim().toUpperCase()] : [])];
}

function digits(value: string): string {
  return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, "") : value;
}

function rank(instrument: IntradayInstrument, code: string): number {
  const [symbol, label, sector] = instrumentAliases(instrument);
  if (symbol === code || label === code) return 0;
  if (digits(symbol).startsWith(digits(code))) return 1;
  if (label.startsWith(code)) return 2;
  if (label.includes(code)) return 3;
  if (sector && sector.startsWith(code)) return 4;
  return -1;
}

/**
 * Ranked matches for a partially typed code, name or sector. Exact codes win,
 * then code prefixes, then names; feed order breaks ties so the list is stable.
 */
export function searchInstruments(instruments: IntradayInstrument[], raw: string, limit = 6): IntradayInstrument[] {
  const code = normalizeCode(raw);
  if (code.length === 0) return [];
  return instruments
    .map((instrument, position) => ({ instrument, position, score: rank(instrument, code) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => left.score - right.score || left.position - right.position)
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.instrument);
}

/**
 * Resolves a submitted code against the trusted universe. Unknown codes stay
 * honest: nothing is charted and the closest trusted instruments are offered
 * instead, because the canvas may only display facts the feed published.
 */
export function lookupInstrument(instruments: IntradayInstrument[], raw: string): SymbolLookup {
  const code = normalizeCode(raw);
  if (code.length === 0) return { state: "idle" };
  const matches = searchInstruments(instruments, code);
  if (matches.length > 0) return { state: "resolved", instrument: matches[0] };
  return { state: "unknown", code, suggestions: instruments.slice(0, 4) };
}

/** Recently resolved codes, most recent first and without duplicates. */
export function rememberCode(history: string[], symbol: string, limit = 5): string[] {
  const next = [symbol, ...history.filter((entry) => entry !== symbol)];
  return next.slice(0, Math.max(1, limit));
}
