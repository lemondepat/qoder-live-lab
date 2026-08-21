import type { MarketQuote } from "./market-data";

export type MarketPulse = {
  total: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  advancerShare: number;
  averageChange: number;
  leader: MarketQuote | null;
  laggard: MarketQuote | null;
};

export function computeMarketPulse(quotes: MarketQuote[]): MarketPulse {
  const total = quotes.length;
  const advancers = quotes.filter((quote) => quote.change > 0).length;
  const decliners = quotes.filter((quote) => quote.change < 0).length;
  const sum = quotes.reduce((carry, quote) => carry + quote.change, 0);
  const ranked = [...quotes].sort((a, b) => b.change - a.change);

  return {
    total,
    advancers,
    decliners,
    unchanged: total - advancers - decliners,
    advancerShare: total === 0 ? 0 : Math.round((advancers / total) * 100),
    averageChange: total === 0 ? 0 : sum / total,
    leader: ranked[0] ?? null,
    laggard: ranked.length > 0 ? ranked[ranked.length - 1] : null,
  };
}
