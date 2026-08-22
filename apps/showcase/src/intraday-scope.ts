import type { MarketIndex, MarketIntradayPoint, MarketQuote } from "./market-data";

export type IntradayScope = "index" | "stock";

/** A single chartable instrument, normalized from an index or an equity. */
export type IntradayInstrument = {
  symbol: string;
  label: string;
  displayValue: string;
  last: number | null;
  previousClose: number | null;
  change: number;
  intraday: MarketIntradayPoint[];
  kind: IntradayScope;
  meta: string | null;
};

/** Formats a numeric level with the Hong Kong two-decimal convention. */
export function formatLevel(value: number): string {
  return new Intl.NumberFormat("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** Normalizes a trusted index into a chartable instrument. */
export function indexInstrument(index: MarketIndex): IntradayInstrument {
  return {
    symbol: index.symbol,
    label: index.label,
    displayValue: index.value,
    last: index.last,
    previousClose: index.previousClose,
    change: index.change,
    intraday: index.intraday,
    kind: "index",
    meta: null,
  };
}

/** Normalizes a trusted equity quote into a chartable instrument. */
export function stockInstrument(quote: MarketQuote): IntradayInstrument {
  return {
    symbol: quote.symbol,
    label: quote.name,
    displayValue: formatLevel(quote.price),
    last: quote.price,
    previousClose: quote.previousClose,
    change: quote.change,
    intraday: quote.intraday,
    kind: "stock",
    meta: `${quote.sector} · VOL ${quote.volume}`,
  };
}

/** The instruments available for a given scope tab, preserving feed order. */
export function scopeInstruments(scope: IntradayScope, indices: MarketIndex[], quotes: MarketQuote[]): IntradayInstrument[] {
  return scope === "stock" ? quotes.map(stockInstrument) : indices.map(indexInstrument);
}

/** Resolves the focused instrument, falling back to the first available one. */
export function resolveActive(instruments: IntradayInstrument[], focus: string): IntradayInstrument | null {
  return instruments.find((instrument) => instrument.symbol === focus) ?? instruments[0] ?? null;
}
