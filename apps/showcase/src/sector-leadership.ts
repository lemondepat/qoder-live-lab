import type { MarketQuote } from "./market-data";

export type SectorCell = {
  quote: MarketQuote;
  weight: number;
  share: number;
  intensity: number;
};

export type SectorBlock = {
  sector: string;
  cells: SectorCell[];
  averageChange: number;
  weight: number;
  share: number;
  span: number;
  rows: number;
  intensity: number;
  advancers: number;
  decliners: number;
  leader: MarketQuote;
  turnoverBacked: boolean;
};

export type BoardTotals = {
  sectors: number;
  names: number;
  advancers: number;
  decliners: number;
  averageChange: number;
  dispersion: number;
  strongest: SectorBlock | null;
  weakest: SectorBlock | null;
};

/** Session turnover observed in the trusted minute bars; 0 when the backfill has not arrived. */
export function sessionTurnover(quote: MarketQuote) {
  return quote.intraday.reduce((carry, point) => carry + (Number.isFinite(point.turnover) ? point.turnover : 0), 0);
}

/** Tile weight: trusted session turnover when present, otherwise the absolute live move. */
export function quoteWeight(quote: MarketQuote) {
  const turnover = sessionTurnover(quote);
  return turnover > 0 ? turnover : Math.abs(quote.change) + 0.25;
}

export function buildSectorBoard(quotes: MarketQuote[]): SectorBlock[] {
  const grouped = new Map<string, MarketQuote[]>();
  for (const quote of quotes) {
    const sector = quote.sector || "Unclassified";
    grouped.set(sector, [...(grouped.get(sector) ?? []), quote]);
  }

  const raw = [...grouped.entries()].map(([sector, members]) => {
    const weights = members.map(quoteWeight);
    const weight = weights.reduce((carry, value) => carry + value, 0);
    const averageChange = members.reduce((carry, quote) => carry + quote.change, 0) / members.length;
    const ranked = [...members].sort((a, b) => b.change - a.change);
    return { sector, members, weight, averageChange, leader: ranked[0], turnoverBacked: members.some((quote) => sessionTurnover(quote) > 0) };
  });

  const boardWeight = raw.reduce((carry, entry) => carry + entry.weight, 0) || 1;
  const loudest = Math.max(...raw.map((entry) => Math.abs(entry.averageChange)), 0.01);

  return raw
    .sort((a, b) => b.weight - a.weight || a.sector.localeCompare(b.sector))
    .map((entry) => {
      const share = entry.weight / boardWeight;
      const cellWeight = entry.weight || 1;
      return {
        sector: entry.sector,
        averageChange: entry.averageChange,
        weight: entry.weight,
        share,
        span: tileSpan(share),
        rows: share >= 0.28 ? 2 : 1,
        intensity: Math.min(1, Math.abs(entry.averageChange) / loudest),
        advancers: entry.members.filter((quote) => quote.change > 0).length,
        decliners: entry.members.filter((quote) => quote.change < 0).length,
        leader: entry.leader,
        turnoverBacked: entry.turnoverBacked,
        cells: entry.members
          .sort((a, b) => b.change - a.change)
          .map((quote) => ({
            quote,
            weight: quoteWeight(quote),
            share: quoteWeight(quote) / cellWeight,
            intensity: Math.min(1, Math.abs(quote.change) / loudest),
          })),
      };
    });
}

export function tileSpan(share: number) {
  return Math.max(3, Math.min(12, Math.round(share * 14) || 3));
}

export function boardTotals(board: SectorBlock[]): BoardTotals {
  const cells = board.flatMap((block) => block.cells);
  const changes = cells.map((cell) => cell.quote.change);
  const averageChange = changes.length === 0 ? 0 : changes.reduce((carry, value) => carry + value, 0) / changes.length;
  const byChange = [...board].sort((a, b) => b.averageChange - a.averageChange);

  return {
    sectors: board.length,
    names: cells.length,
    advancers: changes.filter((change) => change > 0).length,
    decliners: changes.filter((change) => change < 0).length,
    averageChange,
    dispersion: changes.length === 0 ? 0 : Math.max(...changes) - Math.min(...changes),
    strongest: byChange[0] ?? null,
    weakest: byChange.length > 0 ? byChange[byChange.length - 1] : null,
  };
}

/** Normalized 0..100 trail used for the tile spark, from the trusted price tail. */
export function normalizedTrail(trail: number[]) {
  if (trail.length === 0) return [];
  const low = Math.min(...trail);
  const range = Math.max(...trail) - low || 1;
  return trail.map((value) => ((value - low) / range) * 100);
}
