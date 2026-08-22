import type { MarketQuote } from "../market-data";
import { FeatureMarketTile } from "./shared";
import "./feature-library.css";

export function MomentumLensFeature({ quotes }: { quotes: MarketQuote[] }) {
  const ranked = [...quotes].sort((left, right) => Math.abs(right.change) - Math.abs(left.change));
  return <section className="feature-pack-shell feature-pack-momentum">
    <header className="feature-pack-heading"><div><span>QODER ACCELERATOR · LIVE MOMENTUM</span><h1>Momentum lens</h1></div><p>Ranked trusted trails turn a table into an analytical cockpit.</p></header>
    <div className="feature-market-grid">{ranked.map((quote) => <FeatureMarketTile key={`${quote.symbol}-${quote.timestamp || "demo"}`} quote={quote} showTrail />)}</div>
  </section>;
}
