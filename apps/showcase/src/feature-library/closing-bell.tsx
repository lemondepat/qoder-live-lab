import type { MarketQuote } from "../market-data";
import { computeMarketPulse } from "../market-pulse";
import { closingCountdown, signedPercent } from "./shared";
import "./feature-library.css";

export function ClosingBellFeature({ quotes, clock, session }: { quotes: MarketQuote[]; clock: string; session: string }) {
  const pulse = computeMarketPulse(quotes);
  const countdown = closingCountdown(clock);
  return <section className="feature-closing">
    <div className="feature-closing-glow" aria-hidden="true" />
    <div className="feature-closing-kicker"><span>{session === "closed" ? "SESSION COMPLETE" : "COUNTDOWN TO 16:00 HKT"}</span><i>{session.toUpperCase()}</i></div>
    <div className="feature-closing-clock"><small>CLOSING BELL</small><strong>{session === "closed" ? "CLOSED" : countdown}</strong><span>{clock} HKT · LIVE</span></div>
    <div className="feature-closing-spotlights">
      <article className="leader"><small>SESSION LEADER</small><b>{pulse.leader?.symbol ?? "—"}</b><strong>{pulse.leader ? signedPercent(pulse.leader.change) : "—"}</strong><span>{pulse.leader?.name ?? "Awaiting market facts"}</span></article>
      <article className="breadth-card"><small>WATCHLIST BREADTH</small><b>{pulse.advancerShare}%</b><strong>{pulse.advancers} ADVANCING · {pulse.decliners} DECLINING</strong><span>Derived from {pulse.total} trusted live quotes</span></article>
      <article className="laggard"><small>SESSION LAGGARD</small><b>{pulse.laggard?.symbol ?? "—"}</b><strong>{pulse.laggard ? signedPercent(pulse.laggard.change) : "—"}</strong><span>{pulse.laggard?.name ?? "Awaiting market facts"}</span></article>
    </div>
    <div className="feature-closing-ticker"><div>{[...quotes, ...quotes].map((quote, index) => <span key={`${quote.symbol}-${index}`}>{quote.symbol} <i className={quote.change >= 0 ? "up" : "down"}>{signedPercent(quote.change)}</i></span>)}</div></div>
  </section>;
}
