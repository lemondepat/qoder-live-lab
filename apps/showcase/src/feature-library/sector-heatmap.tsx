import type { MarketQuote } from "../market-data";
import { FeatureMarketTile } from "./shared";
import "./feature-library.css";

export function SectorHeatmapFeature({ quotes }: { quotes: MarketQuote[] }) {
  return <section className="feature-pack-shell feature-pack-sector">
    <header className="feature-pack-heading"><div><span>QODER ACCELERATOR · LIVE LEADERSHIP</span><h1>Sector heatmap</h1></div><p>Tile size and color expose live market leadership.</p></header>
    <div className="feature-market-grid">{quotes.map((quote) => <FeatureMarketTile key={`${quote.symbol}-${quote.timestamp || "demo"}`} quote={quote} showTrail={false} />)}</div>
  </section>;
}
