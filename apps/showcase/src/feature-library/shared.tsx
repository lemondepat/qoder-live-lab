import type { MarketQuote } from "../market-data";

export function FeatureMarketTile({ quote, showTrail }: { quote: MarketQuote; showTrail: boolean }) {
  const minimum = Math.min(...quote.trail);
  const range = Math.max(...quote.trail) - minimum || 1;
  const points = quote.trail.map((value, index) => `${quote.trail.length === 1 ? 50 : (index / (quote.trail.length - 1)) * 100},${85 - ((value - minimum) / range) * 70}`).join(" ");
  return <article className={`feature-market-tile quote-tick ${quote.change >= 0 ? "positive" : "negative"}`}>
    <div className="feature-tile-top"><span>{quote.symbol}</span><small>{quote.sector}</small></div>
    <h2>{quote.name}</h2>
    <div className="feature-tile-price"><strong>{quote.price.toFixed(2)}</strong><b>{signedPercent(quote.change)}</b></div>
    {showTrail && <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${quote.name} trusted price trail`}><polyline points={points} /></svg>}
    <div className="feature-tile-volume">VOL {quote.volume}</div>
  </article>;
}

export function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function closingCountdown(clock: string) {
  const [hours, minutes, seconds] = clock.split(":").map(Number);
  const remaining = Math.max(0, 16 * 3600 - (hours * 3600 + minutes * 60 + seconds));
  return [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60].map((value) => String(value).padStart(2, "0")).join(":");
}
