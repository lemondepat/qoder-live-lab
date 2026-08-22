"use client";

import { useEffect, useState } from "react";
import { useMarketFeed } from "./market-feed";
import type { MarketIndex, MarketQuote } from "./market-data";
import { computeMarketPulse } from "./market-pulse";
import { derivePreviousClose, parseIndexValue } from "./kline";
import { appendPoint, intradayBounds, intradayStats, priceLevels, projectPoints, timeAxis, toAreaPath, toLinePath, type IntradayBounds, type IntradayPoint } from "./intraday";
import "./showcase.css";

const TICK_LIMIT = 240;

type Edition = "baseline" | "sector-heatmap" | "momentum-lens" | "market-command";

export function Showcase() {
  const [edition, setEdition] = useState<Edition>("baseline");
  const [clock, setClock] = useState("13:42:08");
  const market = useMarketFeed();

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("edition") as Edition | null;
    const kickoff = window.setTimeout(() => {
      if (selected && ["sector-heatmap", "momentum-lens", "market-command"].includes(selected)) setEdition(selected);
    }, 0);
    const timer = window.setInterval(() => {
      setClock(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).format(new Date()));
    }, 1000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(timer); };
  }, []);

  const quotes = market.quotes;
  const advanced = edition !== "baseline";
  const feedTitle = market.status === "live" && market.session === "closed" ? "MARKET CLOSED · LIVE FEED" : market.status === "live" ? "LIVE MARKET FEED" : market.status === "stale" ? "STALE · LAST GOOD TICK" : market.status === "delayed" ? "DELAYED MARKET FEED" : "DEMO · AWAITING LIVE FEED";
  const feedDetail = market.source === "longbridge" ? `${market.session.toUpperCase()} · SEQ ${market.sequence}` : "Trusted data plane ready";
  const sessionLabel = market.session === "closed" ? "MARKET CLOSED" : `${market.session.toUpperCase()} SESSION`;

  return (
    <main className={`market-shell edition-${edition}`}>
      <header className="market-header">
        <div className="market-brand"><span className="qoder-brand-icon" aria-hidden="true" /><div><b>MARKET PULSE / HK</b><small>Built · verified · deployed by Qoder</small></div></div>
        <div className="market-session"><i className={market.status === "live" ? "is-live" : ""} /> {sessionLabel} <b>{clock} HKT</b></div>
        <div className={`feed-state feed-${market.status}`}><span>{feedTitle}</span><small>{feedDetail}</small></div>
      </header>
      <section className="index-row">
        {market.indices.map((index) => <article key={`${index.symbol}-${market.sequence}`}><div><span>{index.symbol}</span><small>{index.label}</small></div><strong>{index.value}</strong><b className={index.change >= 0 ? "up" : "down"}>{index.change >= 0 ? "+" : ""}{index.change.toFixed(2)}%</b></article>)}
      </section>
      <IntradayLive indices={market.indices} sequence={market.sequence} sessionLabel={sessionLabel} session={market.session} status={market.status} />
      <MarketPulseStrip quotes={quotes} />
      {edition === "baseline" ? <BaselineTable quotes={quotes} /> : <EnhancedMarket quotes={quotes} edition={edition} />}
      <footer className="market-footer"><span>DISPLAY ONLY · NOT INVESTMENT ADVICE</span><span>{market.source === "longbridge" ? "VERIFIED MARKET DATA" : advanced ? `FEATURE EDITION / ${edition.toUpperCase()}` : "BASELINE RELEASE / INTENTIONALLY SIMPLE"}</span></footer>
    </main>
  );
}

const tickLog = new Map<string, { key: string; points: IntradayPoint[] }>();

function IntradayLive({ indices, sequence, sessionLabel, session, status }: { indices: MarketIndex[]; sequence: number; sessionLabel: string; session: string; status: string }) {
  const [focus, setFocus] = useState("HSI");
  const active = indices.find((index) => index.symbol === focus) ?? indices[0] ?? null;
  const activeSymbol = active?.symbol ?? focus;
  const observed = parseIndexValue(active?.value ?? "");

  useEffect(() => {
    if (observed === null) return;
    const key = `${sequence}:${observed}`;
    const entry = tickLog.get(activeSymbol);
    if (entry?.key === key) return;
    tickLog.set(activeSymbol, { key, points: appendPoint(entry?.points ?? [], { value: observed, at: Date.now() }, TICK_LIMIT) });
  }, [activeSymbol, observed, sequence]);

  const logged = tickLog.get(activeSymbol);
  const points = observed === null || logged?.key === `${sequence}:${observed}`
    ? logged?.points ?? []
    : [...(logged?.points ?? []), { value: observed, at: Date.now() }];
  const previousClose = derivePreviousClose(observed, active?.change ?? 0);
  const bounds = intradayBounds(points, [previousClose]);
  const stats = intradayStats(points, previousClose);
  const tone = (active?.change ?? 0) >= 0 ? "up" : "down";
  const closed = session === "closed";

  return <section className="intraday-panel" aria-label={`${activeSymbol} one day intraday chart`}>
    <div className="intraday-head">
      <div className="intraday-title">
        <span className={`intraday-flag ${status === "live" ? "is-live" : ""}`}>1D INTRADAY · LIVE TICK TRACE</span>
        <h2>{activeSymbol} <small>{active?.label ?? ""}</small></h2>
      </div>
      <div className="intraday-switch" role="group" aria-label="Select index">
        {indices.map((index) => <button key={index.symbol} type="button" className={index.symbol === activeSymbol ? "is-active" : ""} aria-pressed={index.symbol === activeSymbol} onClick={() => setFocus(index.symbol)}>{index.symbol}</button>)}
      </div>
      <dl className="intraday-readout">
        <div><dt>LAST</dt><dd>{active?.value ?? "—"}</dd></div>
        <div><dt>CHANGE</dt><dd className={tone}>{active ? `${active.change >= 0 ? "+" : ""}${active.change.toFixed(2)}%` : "—"}</dd></div>
        <div><dt>PREV CLOSE</dt><dd>{previousClose !== null ? formatLevel(previousClose) : "—"}</dd></div>
        <div><dt>DAY HIGH</dt><dd>{stats ? formatLevel(stats.high) : "—"}</dd></div>
        <div><dt>DAY LOW</dt><dd>{stats ? formatLevel(stats.low) : "—"}</dd></div>
        <div><dt>AMPLITUDE</dt><dd>{stats ? formatLevel(stats.amplitude) : "—"}</dd></div>
      </dl>
    </div>
    <IntradayChart points={points} bounds={bounds} previousClose={previousClose} symbol={activeSymbol} tone={tone} />
    <div className="intraday-foot">
      <span>{closed ? `${sessionLabel} · LAST TRADING DAY` : `${sessionLabel} · ONE-DAY WINDOW`}</span>
      {stats && <span className={stats.changePercent >= 0 ? "up" : "down"}>SESSION OPEN {formatLevel(stats.open)} → LAST {formatLevel(stats.last)}</span>}
      <span>{points.length} TICK{points.length === 1 ? "" : "S"} OBSERVED · DERIVED VIEW, DISPLAY ONLY</span>
    </div>
  </section>;
}

function IntradayChart({ points, bounds, previousClose, symbol, tone }: { points: IntradayPoint[]; bounds: IntradayBounds; previousClose: number | null; symbol: string; tone: string }) {
  if (points.length === 0) return <div className="intraday-empty">Collecting live ticks for {symbol} — the intraday trace starts on the next feed update.</div>;

  const width = 1000;
  const height = 320;
  const padX = 14;
  const padY = 18;
  const coords = projectPoints(points, bounds, width, height, padX, padY);
  const toY = (value: number) => height - padY - ((value - bounds.low) / bounds.span) * (height - padY * 2);
  const baselineY = previousClose !== null ? toY(previousClose) : height - padY;
  const levels = priceLevels(bounds, 5);
  const marks = timeAxis(points, 5);
  const head = coords[coords.length - 1];

  return <div className="intraday-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${symbol} intraday line built from ${points.length} observed ticks`}>
      {levels.map((level, position) => <line key={`guide-${position}`} className="intraday-guide" x1={padX} x2={width - padX} y1={toY(level)} y2={toY(level)} />)}
      <polygon className={`intraday-area ${tone}`} points={toAreaPath(coords, baselineY)} />
      {previousClose !== null && <line className="intraday-prev" x1={padX} x2={width - padX} y1={baselineY} y2={baselineY} />}
      <polyline className={`intraday-line ${tone}`} points={toLinePath(coords)} />
      {head && <g className={`intraday-head-dot ${tone}`}>
        <circle className="intraday-pulse" cx={head.x} cy={head.y} r={9} />
        <circle cx={head.x} cy={head.y} r={3.5} />
      </g>}
    </svg>
    <ul className="intraday-scale" aria-hidden="true">
      {levels.map((level, position) => <li key={`scale-${position}`}>{formatLevel(level)}</li>)}
    </ul>
    <ul className="intraday-time" aria-hidden="true">
      {marks.map((mark) => <li key={mark.at} style={{ left: `${(mark.ratio * 100).toFixed(2)}%` }}>{formatClock(mark.at)}</li>)}
    </ul>
  </div>;
}

function formatClock(at: number) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).format(new Date(at));
}

function formatLevel(value: number) {
  return new Intl.NumberFormat("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function MarketPulseStrip({ quotes }: { quotes: MarketQuote[] }) {
  const pulse = computeMarketPulse(quotes);
  const tone = pulse.averageChange >= 0 ? "up" : "down";
  const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  return <section className="pulse-strip" aria-label="Market pulse breadth">
    <span className="pulse-label">MARKET PULSE</span>
    <div className="pulse-chips">
      <article className="pulse-chip"><small>ADVANCING</small><b className="up">{pulse.advancers}</b></article>
      <article className="pulse-chip"><small>DECLINING</small><b className="down">{pulse.decliners}</b></article>
      <article className="pulse-chip"><small>UNCHANGED</small><b>{pulse.unchanged}</b></article>
      <article className="pulse-chip"><small>BREADTH</small><b className={pulse.advancerShare >= 50 ? "up" : "down"}>{pulse.advancerShare}%</b></article>
      <article className="pulse-chip"><small>AVG MOVE</small><b className={tone}>{signed(pulse.averageChange)}</b></article>
      {pulse.leader && <article className="pulse-chip pulse-chip-wide"><small>LEADER</small><b className="up">{pulse.leader.symbol} {signed(pulse.leader.change)}</b></article>}
      {pulse.laggard && <article className="pulse-chip pulse-chip-wide"><small>LAGGARD</small><b className="down">{pulse.laggard.symbol} {signed(pulse.laggard.change)}</b></article>}
    </div>
    <div className="pulse-meter" role="img" aria-label={`${pulse.advancers} of ${pulse.total} watchlist stocks advancing`}><i style={{ width: `${pulse.advancerShare}%` }} /></div>
  </section>;
}

function BaselineTable({ quotes }: { quotes: MarketQuote[] }) {
  return <section className="baseline-panel"><div className="baseline-title"><div><div className="watchlist-row"><span>WATCHLIST / {quotes.length}</span><ul className="tone-legend" aria-label="Change color legend"><li className="gain"><i />GAIN</li><li className="loss"><i />LOSS</li><li className="flat"><i />FLAT</li></ul></div><h1>Hong Kong<br />market monitor</h1></div><p>This baseline is intentionally simple.<br />Ask Qoder to make it useful.</p></div><div className="plain-table"><div className="table-head"><span>NAME</span><span>LAST</span><span>CHANGE</span><span>VOLUME</span></div>{quotes.map((quote) => <div className="table-row quote-tick" key={`${quote.symbol}-${quote.timestamp || "demo"}`}><span><b>{quote.symbol}</b>{quote.name}</span><strong>{quote.price.toFixed(2)}</strong><b className={quote.change >= 0 ? "up" : "down"}>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}%</b><span>{quote.volume}</span></div>)}</div></section>;
}

function EnhancedMarket({ quotes, edition }: { quotes: MarketQuote[]; edition: Exclude<Edition, "baseline"> }) {
  return <section className="enhanced-panel">
    <div className="enhanced-head"><div><span>MARKET TRANSFORMED</span><h1>{edition === "sector-heatmap" ? "Sector heatmap" : edition === "momentum-lens" ? "Momentum lens" : "Market command"}</h1></div>{edition === "market-command" && <div className="breadth"><span>MARKET BREADTH</span><strong>392 <i>UP</i> / 211 DOWN</strong></div>}</div>
    <div className="market-grid">{quotes.map((quote) => <MarketTile key={`${quote.symbol}-${quote.timestamp || "demo"}`} quote={quote} showTrail={edition !== "sector-heatmap"} />)}</div>
    {edition === "market-command" && <div className="activity-tape"><b>LIVE ACTIVITY</b>{quotes.map((quote) => <span key={quote.symbol}>{quote.symbol} <i className={quote.change >= 0 ? "up" : "down"}>{quote.change >= 0 ? "▲" : "▼"} {Math.abs(quote.change).toFixed(2)}%</i></span>)}</div>}
  </section>;
}

function MarketTile({ quote, showTrail }: { quote: MarketQuote; showTrail: boolean }) {
  const minimum = Math.min(...quote.trail);
  const range = Math.max(...quote.trail) - minimum || 1;
  const points = quote.trail.map((value, index) => `${quote.trail.length === 1 ? 50 : (index / (quote.trail.length - 1)) * 100},${85 - ((value - minimum) / range) * 70}`).join(" ");
  return <article className={`market-tile quote-tick ${quote.change >= 0 ? "positive" : "negative"}`}><div className="tile-top"><span>{quote.symbol}</span><small>{quote.sector}</small></div><h2>{quote.name}</h2><div className="tile-price"><strong>{quote.price.toFixed(2)}</strong><b>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}%</b></div>{showTrail && <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${quote.name} momentum trail`}><polyline points={points} /></svg>}<div className="tile-volume">VOL {quote.volume}</div></article>;
}
