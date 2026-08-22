import type { MarketQuote } from "./market-data";

export type StormCell = {
  symbol: string;
  name: string;
  sector: string;
  change: number;
  price: number;
  amplitude: number;
  energy: number;
  bearing: number;
  ring: number;
  trail: number[];
};

export type VolatilityField = {
  cells: StormCell[];
  dispersion: number;
  spread: number;
  gust: number;
  deviation: number;
  intensity: number;
  beaufort: number;
  label: string;
  advancers: number;
  decliners: number;
  unchanged: number;
  breadth: number;
  strongest: StormCell | null;
  calmest: StormCell | null;
};

const FORCE_LABELS = ["CALM", "LIGHT AIR", "LIGHT BREEZE", "FRESH BREEZE", "STRONG BREEZE", "GALE", "STRONG GALE", "STORM", "VIOLENT STORM", "HURRICANE FORCE"];

export function intradayAmplitude(quote: MarketQuote) {
  const base = quote.previousClose || quote.price;
  if (!base) return 0;
  const prices = quote.intraday.map((point) => point.price).filter((price) => Number.isFinite(price) && price > 0);
  const high = prices.length ? Math.max(...prices) : quote.high ?? null;
  const low = prices.length ? Math.min(...prices) : quote.low ?? null;
  if (high === null || low === null || high <= 0 || low <= 0) return Math.abs(quote.change);
  return ((high - low) / base) * 100;
}

export function beaufortForce(dispersion: number) {
  return Math.max(0, Math.min(FORCE_LABELS.length - 1, Math.round(dispersion * 2)));
}

export function forceLabel(force: number) {
  return FORCE_LABELS[Math.max(0, Math.min(FORCE_LABELS.length - 1, force))];
}

export function computeVolatilityField(quotes: MarketQuote[]): VolatilityField {
  const total = quotes.length;
  if (total === 0) {
    return { cells: [], dispersion: 0, spread: 0, gust: 0, deviation: 0, intensity: 0, beaufort: 0, label: forceLabel(0), advancers: 0, decliners: 0, unchanged: 0, breadth: 0, strongest: null, calmest: null };
  }

  const ranked = [...quotes].sort((left, right) => Math.abs(right.change) - Math.abs(left.change));
  const dispersion = quotes.reduce((sum, quote) => sum + Math.abs(quote.change), 0) / total;
  const mean = quotes.reduce((sum, quote) => sum + quote.change, 0) / total;
  const deviation = Math.sqrt(quotes.reduce((sum, quote) => sum + (quote.change - mean) ** 2, 0) / total);
  const changes = quotes.map((quote) => quote.change);
  const gust = Math.max(...changes.map(Math.abs));
  const advancers = quotes.filter((quote) => quote.change > 0).length;
  const decliners = quotes.filter((quote) => quote.change < 0).length;

  const cells = ranked.map((quote, index) => ({
    symbol: quote.symbol,
    name: quote.name,
    sector: quote.sector,
    change: quote.change,
    price: quote.price,
    amplitude: intradayAmplitude(quote),
    energy: gust === 0 ? 0 : Math.abs(quote.change) / gust,
    bearing: (index * 360) / ranked.length,
    ring: index % 3,
    trail: quote.trail,
  }));

  return {
    cells,
    dispersion,
    spread: Math.max(...changes) - Math.min(...changes),
    gust,
    deviation,
    intensity: Math.min(100, Math.max(10, Math.round(dispersion * 26))),
    beaufort: beaufortForce(dispersion),
    label: forceLabel(beaufortForce(dispersion)),
    advancers,
    decliners,
    unchanged: total - advancers - decliners,
    breadth: Math.round((advancers / total) * 100),
    strongest: cells[0] ?? null,
    calmest: cells.length ? cells[cells.length - 1] : null,
  };
}
