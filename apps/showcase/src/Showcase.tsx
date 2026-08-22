"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useMarketFeed } from "./market-feed";
import type { MarketIndex, MarketQuote } from "./market-data";
import { computeMarketPulse } from "./market-pulse";
import { DEFAULT_FEATURE_EDITION, isFeatureEdition, type FeatureEdition } from "./feature-pack";
import { anchorSeries, appendPoint, clampToSession, formatMinute, hongKongMinute, hongKongTradingDay, intradayExtremes, intradaySpan, linePath, areaPath, observationScope, percentFrom, priceLevels, runningAverage, SESSION, sessionProgress, timeLevels, tradedMinutes, TRADED_MINUTES, trustedIntradaySeries, type IntradayPoint, type IntradaySpan } from "./intraday";
import "./showcase.css";

const POINT_LIMIT = 390;

export function Showcase() {
  const [edition, setEdition] = useState<FeatureEdition>(DEFAULT_FEATURE_EDITION);
  const [clock, setClock] = useState("13:42:08");
  const market = useMarketFeed();

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("edition");
    const kickoff = window.setTimeout(() => {
      if (isFeatureEdition(selected)) setEdition(selected);
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
  const showIntraday = edition === "baseline";

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
      {showIntraday && <IntradayPanel indices={market.indices} sequence={market.sequence} sessionLabel={sessionLabel} session={market.session} marketTimestamp={market.marketTimestamp} status={market.status} source={market.source} />}
      <MarketPulseStrip quotes={quotes} />
      {edition === "baseline" ? <BaselineTable quotes={quotes} /> : <EnhancedMarket quotes={quotes} edition={edition} clock={clock} session={market.session} />}
      <footer className="market-footer"><span>DISPLAY ONLY · NOT INVESTMENT ADVICE</span><span>{market.source === "longbridge" ? "VERIFIED MARKET DATA" : advanced ? `FEATURE EDITION / ${edition.toUpperCase()}` : "BASELINE RELEASE / INTENTIONALLY SIMPLE"}</span></footer>
    </main>
  );
}

const tickTrack = new Map<string, { key: string; points: IntradayPoint[] }>();

function IntradayPanel({ indices, sequence, sessionLabel, session, marketTimestamp, status, source }: { indices: MarketIndex[]; sequence: number; sessionLabel: string; session: string; marketTimestamp: string; status: string; source: string }) {
  const [focus, setFocus] = useState("HSI");
  const active = indices.find((index) => index.symbol === focus) ?? indices[0] ?? null;
  const activeSymbol = active?.symbol ?? focus;
  const observed = active?.last ?? null;
  const stamped = new Date(marketTimestamp);
  const instant = Number.isNaN(stamped.getTime()) ? new Date() : stamped;
  const tradingDay = hongKongTradingDay(instant);
  const minute = clampToSession(hongKongMinute(instant));
  const scope = observationScope(source, tradingDay, activeSymbol);
  const providerPoints = trustedIntradaySeries(active?.intraday ?? [], tradingDay);
  const hasOfficialMinutes = providerPoints.length > 0;

  useEffect(() => {
    if (observed === null || hasOfficialMinutes) return;
    const key = `${scope}:${sequence}:${observed}`;
    const entry = tickTrack.get(scope);
    if (entry?.key === key) return;
    tickTrack.set(scope, { key, points: appendPoint(entry?.points ?? [], { minute, value: observed }, POINT_LIMIT) });
  }, [scope, observed, sequence, minute, hasOfficialMinutes]);

  const tracked = tickTrack.get(scope);
  const observedPoints = observed === null || tracked?.key === `${scope}:${sequence}:${observed}`
    ? tracked?.points ?? []
    : appendPoint(tracked?.points ?? [], { minute, value: observed }, POINT_LIMIT);
  const points = hasOfficialMinutes ? providerPoints : observedPoints;
  const previousClose = active?.previousClose ?? null;
  const span = intradaySpan(points, [previousClose]);
  const average = runningAverage(points);
  const extremes = intradayExtremes(points);
  const tone = (active?.change ?? 0) >= 0 ? "up" : "down";
  const closed = session === "closed";
  const elapsed = tradedMinutes(minute);
  const progress = Math.round(sessionProgress(minute) * 100);
  const amplitude = extremes && previousClose ? ((extremes.high - extremes.low) / previousClose) * 100 : null;

  return <section className={`intraday-panel tone-${tone}`} aria-label={`${activeSymbol} one day intraday chart`}>
    <div className="intraday-head">
      <div className="intraday-title">
        <span>INTRADAY · 1 DAY · {hasOfficialMinutes ? "OFFICIAL MINUTE BARS" : "LIVE LINE FROM OBSERVED TICKS"}</span>
        <h2>{activeSymbol} <small>{active?.label ?? ""}</small></h2>
      </div>
      <div className="intraday-switch" role="group" aria-label="Select index">
        {indices.map((index) => <button key={index.symbol} type="button" className={index.symbol === activeSymbol ? "is-active" : ""} aria-pressed={index.symbol === activeSymbol} onClick={() => setFocus(index.symbol)}>
          <b>{index.symbol}</b><i className={index.change >= 0 ? "up" : "down"}>{index.change >= 0 ? "+" : ""}{index.change.toFixed(2)}%</i>
        </button>)}
      </div>
      <dl className="intraday-readout">
        <div><dt>LAST</dt><dd>{active?.value ?? "—"}</dd></div>
        <div><dt>DAY CHANGE</dt><dd className={tone}>{active ? `${active.change >= 0 ? "+" : ""}${active.change.toFixed(2)}%` : "—"}</dd></div>
        <div><dt>PREV CLOSE</dt><dd>{previousClose !== null ? formatLevel(previousClose) : "—"}</dd></div>
        <div><dt>DAY HIGH</dt><dd className="up">{extremes ? formatLevel(extremes.high) : "—"} <i>{extremes ? formatMinute(extremes.highMinute) : ""}</i></dd></div>
        <div><dt>DAY LOW</dt><dd className="down">{extremes ? formatLevel(extremes.low) : "—"} <i>{extremes ? formatMinute(extremes.lowMinute) : ""}</i></dd></div>
        <div><dt>AMPLITUDE</dt><dd>{amplitude !== null ? `${amplitude.toFixed(2)}%` : "—"}</dd></div>
      </dl>
    </div>
    <IntradayChart points={points} average={average} span={span} previousClose={previousClose} symbol={activeSymbol} minute={minute} tone={tone} live={status === "live" && !closed} />
    <div className="intraday-progress" role="img" aria-label={`${progress}% of the trading session elapsed`}>
      <i style={{ width: `${progress}%` }} />
      <span>{closed ? "SESSION COMPLETE" : `${elapsed} / ${TRADED_MINUTES} TRADING MINUTES`}</span>
    </div>
    <div className="intraday-foot">
      <span>{closed ? `${sessionLabel} · LAST TRADING DAY` : sessionLabel} · 09:30–16:00 HKT · LUNCH 12:00–13:00 COMPRESSED</span>
      <span>{points.length} {hasOfficialMinutes ? "OFFICIAL MINUTE BAR" : "INTRADAY POINT"}{points.length === 1 ? "" : "S"} · RUNNING PRICE AVERAGE</span>
      <span>DERIVED VIEW · DISPLAY ONLY</span>
    </div>
  </section>;
}

function IntradayChart({ points, average, span, previousClose, symbol, minute, tone, live }: { points: IntradayPoint[]; average: IntradayPoint[]; span: IntradaySpan; previousClose: number | null; symbol: string; minute: number; tone: string; live: boolean }) {
  if (points.length === 0) return <div className="intraday-empty">Tracking today&apos;s live ticks for {symbol} — the intraday line starts drawing on the next feed update.</div>;

  const width = 1000;
  const height = 340;
  const padY = 16;
  const padX = 12;
  const toX = (value: number) => padX + sessionProgress(value) * (width - padX * 2);
  const toY = (value: number) => height - padY - ((value - span.low) / span.span) * (height - padY * 2);
  const prices = priceLevels(span, 5);
  const times = timeLevels();
  const previousY = previousClose !== null ? toY(previousClose) : null;
  const drawn = anchorSeries(previousClose, points);
  const line = linePath(drawn, toX, toY);
  const area = areaPath(drawn, toX, toY, height - padY);
  const meanLine = linePath(average, toX, toY);
  const head = points[points.length - 1];
  const headX = toX(head.minute);
  const headY = toY(head.value);
  const nowX = toX(minute);

  return <div className="intraday-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${symbol} intraday line built from ${points.length} observed ticks`}>
      <defs>
        <linearGradient id={`intraday-fill-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".34" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {prices.map((level, position) => <line key={`price-${position}`} className="intraday-guide" x1={padX} x2={width - padX} y1={toY(level)} y2={toY(level)} />)}
      {times.map((stamp) => <g key={`time-${stamp}`}>
        <line className="intraday-time" x1={toX(stamp)} x2={toX(stamp)} y1={padY} y2={height - padY} />
        <text className="intraday-tick" x={toX(stamp)} y={height - 2} textAnchor="middle">{formatMinute(stamp)}</text>
      </g>)}
      <rect className="intraday-break" x={toX(SESSION.lunchStart)} y={padY} width={Math.max(2, toX(SESSION.lunchEnd) - toX(SESSION.lunchStart))} height={height - padY * 2} />
      {previousY !== null && <line className="intraday-prev" x1={padX} x2={width - padX} y1={previousY} y2={previousY} />}
      <path className="intraday-area" d={area} fill={`url(#intraday-fill-${tone})`} />
      <path className="intraday-line" d={line} />
      {meanLine && <path className="intraday-mean" d={meanLine} />}
      <line className="intraday-now" x1={nowX} x2={nowX} y1={padY} y2={height - padY} />
      <circle className="intraday-dot" cx={headX} cy={headY} r="4.5" />
      {live && <circle className="intraday-ping" cx={headX} cy={headY} r="4.5" />}
    </svg>
    <ul className="intraday-scale" aria-hidden="true">
      {prices.map((level, position) => {
        const offset = percentFrom(previousClose, level);
        return <li key={`scale-${position}`} className={offset === null ? "" : offset >= 0 ? "up" : "down"}>
          <b>{formatLevel(level)}</b>{offset !== null && <small>{offset >= 0 ? "+" : ""}{offset.toFixed(2)}%</small>}
        </li>;
      })}
    </ul>
  </div>;
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

function EnhancedMarket({ quotes, edition, clock, session }: { quotes: MarketQuote[]; edition: Exclude<FeatureEdition, "baseline">; clock: string; session: string }) {
  if (edition === "volatility-storm") return <VolatilityStorm quotes={quotes} />;
  if (edition === "closing-bell") return <ClosingBell quotes={quotes} clock={clock} session={session} />;
  const pulse = computeMarketPulse(quotes);
  return <section className="enhanced-panel">
    <div className="enhanced-head"><div><span>MARKET TRANSFORMED</span><h1>{edition === "sector-heatmap" ? "Sector heatmap" : edition === "momentum-lens" ? "Momentum lens" : "Market command"}</h1></div>{edition === "market-command" && <div className="breadth"><span>WATCHLIST BREADTH</span><strong>{pulse.advancers} <i>UP</i> / {pulse.decliners} DOWN</strong></div>}</div>
    <div className="market-grid">{quotes.map((quote) => <MarketTile key={`${quote.symbol}-${quote.timestamp || "demo"}`} quote={quote} showTrail={edition !== "sector-heatmap"} />)}</div>
    {edition === "market-command" && <div className="activity-tape"><b>LIVE ACTIVITY</b>{quotes.map((quote) => <span key={quote.symbol}>{quote.symbol} <i className={quote.change >= 0 ? "up" : "down"}>{quote.change >= 0 ? "▲" : "▼"} {Math.abs(quote.change).toFixed(2)}%</i></span>)}</div>}
  </section>;
}

function VolatilityStorm({ quotes }: { quotes: MarketQuote[] }) {
  const ranked = [...quotes].sort((left, right) => Math.abs(right.change) - Math.abs(left.change));
  const strongest = ranked[0];
  const dispersion = quotes.length ? quotes.reduce((sum, quote) => sum + Math.abs(quote.change), 0) / quotes.length : 0;
  const intensity = Math.min(100, Math.max(12, dispersion * 24));
  return <section className="volatility-panel" style={{ "--storm-intensity": `${intensity}%` } as CSSProperties}>
    <div className="storm-copy"><span>LIVE DISPERSION ENGINE</span><h1>Volatility<br /><em>storm</em></h1><p>Every orbit is driven by the watchlist&apos;s real percentage moves. The atmosphere intensifies as dispersion rises.</p><dl><div><dt>MEAN ABS MOVE</dt><dd>{dispersion.toFixed(2)}%</dd></div><div><dt>STRONGEST CELL</dt><dd>{strongest ? `${strongest.symbol} · ${signedPercent(strongest.change)}` : "—"}</dd></div><div><dt>LIVE CELLS</dt><dd>{quotes.length}</dd></div></dl></div>
    <div className="storm-radar" role="img" aria-label={`Volatility field with ${dispersion.toFixed(2)} percent mean absolute move`}>
      <i className="storm-orbit orbit-one" /><i className="storm-orbit orbit-two" /><i className="storm-orbit orbit-three" />
      <div className="storm-core"><small>DISPERSION</small><strong>{dispersion.toFixed(2)}</strong><span>% MEAN MOVE</span></div>
      {ranked.slice(0, 6).map((quote, index) => <article key={quote.symbol} className={quote.change >= 0 ? "positive" : "negative"} style={{ "--storm-index": index } as CSSProperties}><b>{quote.symbol}</b><span>{signedPercent(quote.change)}</span></article>)}
    </div>
  </section>;
}

function ClosingBell({ quotes, clock, session }: { quotes: MarketQuote[]; clock: string; session: string }) {
  const pulse = computeMarketPulse(quotes);
  const countdown = closingCountdown(clock);
  return <section className="closing-panel">
    <div className="closing-glow" aria-hidden="true" />
    <div className="closing-kicker"><span>{session === "closed" ? "SESSION COMPLETE" : "COUNTDOWN TO 16:00 HKT"}</span><i>{session.toUpperCase()}</i></div>
    <div className="closing-clock"><small>CLOSING BELL</small><strong>{session === "closed" ? "CLOSED" : countdown}</strong><span>{clock} HKT · LIVE</span></div>
    <div className="closing-spotlights">
      <article className="leader"><small>SESSION LEADER</small><b>{pulse.leader?.symbol ?? "—"}</b><strong>{pulse.leader ? signedPercent(pulse.leader.change) : "—"}</strong><span>{pulse.leader?.name ?? "Awaiting market facts"}</span></article>
      <article className="breadth-card"><small>WATCHLIST BREADTH</small><b>{pulse.advancerShare}%</b><strong>{pulse.advancers} ADVANCING · {pulse.decliners} DECLINING</strong><span>Derived from {pulse.total} trusted live quotes</span></article>
      <article className="laggard"><small>SESSION LAGGARD</small><b>{pulse.laggard?.symbol ?? "—"}</b><strong>{pulse.laggard ? signedPercent(pulse.laggard.change) : "—"}</strong><span>{pulse.laggard?.name ?? "Awaiting market facts"}</span></article>
    </div>
    <div className="closing-ticker"><div>{[...quotes, ...quotes].map((quote, index) => <span key={`${quote.symbol}-${index}`}>{quote.symbol} <i className={quote.change >= 0 ? "up" : "down"}>{signedPercent(quote.change)}</i></span>)}</div></div>
  </section>;
}

function closingCountdown(clock: string) {
  const [hours, minutes, seconds] = clock.split(":").map(Number);
  const remaining = Math.max(0, 16 * 3600 - (hours * 3600 + minutes * 60 + seconds));
  return [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60].map((value) => String(value).padStart(2, "0")).join(":");
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function MarketTile({ quote, showTrail }: { quote: MarketQuote; showTrail: boolean }) {
  const minimum = Math.min(...quote.trail);
  const range = Math.max(...quote.trail) - minimum || 1;
  const points = quote.trail.map((value, index) => `${quote.trail.length === 1 ? 50 : (index / (quote.trail.length - 1)) * 100},${85 - ((value - minimum) / range) * 70}`).join(" ");
  return <article className={`market-tile quote-tick ${quote.change >= 0 ? "positive" : "negative"}`}><div className="tile-top"><span>{quote.symbol}</span><small>{quote.sector}</small></div><h2>{quote.name}</h2><div className="tile-price"><strong>{quote.price.toFixed(2)}</strong><b>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}%</b></div>{showTrail && <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${quote.name} momentum trail`}><polyline points={points} /></svg>}<div className="tile-volume">VOL {quote.volume}</div></article>;
}
