import type { MarketQuote } from "../market-data";
import { computeMarketPulse } from "../market-pulse";
import { FeatureMarketTile, signedPercent } from "./shared";
import "./feature-library.css";

export function MarketCommandFeature({ quotes }: { quotes: MarketQuote[] }) {
  const pulse = computeMarketPulse(quotes);
  return <section className="feature-pack-shell feature-pack-command">
    <header className="feature-pack-heading"><div><span>QODER ACCELERATOR · LIVE COMMAND</span><h1>Market command</h1></div><div className="feature-breadth"><span>WATCHLIST BREADTH</span><strong>{pulse.advancers} <i>UP</i> / {pulse.decliners} DOWN</strong></div></header>
    <div className="feature-market-grid">{quotes.map((quote) => <FeatureMarketTile key={`${quote.symbol}-${quote.timestamp || "demo"}`} quote={quote} showTrail />)}</div>
    <div className="feature-activity-tape"><b>LIVE ACTIVITY</b>{quotes.map((quote) => <span key={quote.symbol}>{quote.symbol} <i className={quote.change >= 0 ? "up" : "down"}>{signedPercent(quote.change)}</i></span>)}</div>
  </section>;
}
