import type { CSSProperties } from "react";
import type { MarketQuote } from "../market-data";
import { signedPercent } from "./shared";
import "./feature-library.css";

export function VolatilityStormFeature({ quotes }: { quotes: MarketQuote[] }) {
  const ranked = [...quotes].sort((left, right) => Math.abs(right.change) - Math.abs(left.change));
  const strongest = ranked[0];
  const dispersion = quotes.length ? quotes.reduce((sum, quote) => sum + Math.abs(quote.change), 0) / quotes.length : 0;
  const intensity = Math.min(100, Math.max(12, dispersion * 24));
  return <section className="feature-volatility" style={{ "--storm-intensity": `${intensity}%` } as CSSProperties}>
    <div className="feature-storm-copy"><span>QODER ACCELERATOR · LIVE DISPERSION</span><h1>Volatility<br /><em>storm</em></h1><p>Every orbit is driven by the watchlist&apos;s real percentage moves. The atmosphere intensifies as dispersion rises.</p><dl><div><dt>MEAN ABS MOVE</dt><dd>{dispersion.toFixed(2)}%</dd></div><div><dt>STRONGEST CELL</dt><dd>{strongest ? `${strongest.symbol} · ${signedPercent(strongest.change)}` : "—"}</dd></div><div><dt>LIVE CELLS</dt><dd>{quotes.length}</dd></div></dl></div>
    <div className="feature-storm-radar" role="img" aria-label={`Volatility field with ${dispersion.toFixed(2)} percent mean absolute move`}>
      <i className="feature-storm-orbit orbit-one" /><i className="feature-storm-orbit orbit-two" /><i className="feature-storm-orbit orbit-three" />
      <div className="feature-storm-core"><small>DISPERSION</small><strong>{dispersion.toFixed(2)}</strong><span>% MEAN MOVE</span></div>
      {ranked.slice(0, 6).map((quote, index) => <article key={quote.symbol} className={quote.change >= 0 ? "positive" : "negative"} style={{ "--storm-index": index } as CSSProperties}><b>{quote.symbol}</b><span>{signedPercent(quote.change)}</span></article>)}
    </div>
  </section>;
}
