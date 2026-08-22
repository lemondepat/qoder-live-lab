"use client";

import { useEffect, useRef, useState } from "react";
import { useMarketFeed } from "./market-feed";
import type { MarketIndex, MarketQuote } from "./market-data";
import { computeMarketPulse } from "./market-pulse";
import { derivePreviousClose, parseIndexValue } from "./kline";
import {
  appendIntradaySample,
  intradayBounds,
  intradayLadder,
  minuteOfDayHKT,
  sessionProgress,
  SESSION_TIMES,
  type IntradayBounds,
  type IntradaySample,
} from "./intraday";
import "./showcase.css";

const SAMPLE_LIMIT = 480;

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
      <IntradayLive indices={market.indices} sequence={market.sequence} sessionLabel={sessionLabel} session={market.session} receivedAt={market.receivedAt} />
      <MarketPulseStrip quotes={quotes} />
      {edition === "baseline" ? <BaselineTable quotes={quotes} /> : <EnhancedMarket quotes={quotes} edition={edition} />}
      <footer className="market-footer"><span>DISPLAY ONLY · NOT INVESTMENT ADVICE</span><span>{market.source === "longbridge" ? "VERIFIED MARKET DATA" : advanced ? `FEATURE EDITION / ${edition.toUpperCase()}` : "BASELINE RELEASE / INTENTIONALLY SIMPLE"}</span></footer>
    </main>
  );
}

const intradayLog = new Map<string, { key: string; samples: IntradaySample[] }>();

function IntradayLive({ indices, sequence, sessionLabel, session, receivedAt }: { indices: MarketIndex[]; sequence: number; sessionLabel: string; session: string; receivedAt: string }) {
  const [focus, setFocus] = useState("HSI");
  const active = indices.find((index) => index.symbol === focus) ?? indices[0] ?? null;
  const activeSymbol = active?.symbol ?? focus;
  const observed = parseIndexValue(active?.value ?? "");
  const tickTime = useTickTime(receivedAt, sequence);

  useEffect(() => {
    if (observed === null) return;
    const key = `${sequence}:${observed}`;
    const entry = intradayLog.get(activeSymbol);
    if (entry?.key === key) return;
    const nextSamples = appendIntradaySample(entry?.samples ?? [], { t: tickTime, v: observed }, SAMPLE_LIMIT);
    intradayLog.set(activeSymbol, { key, samples: nextSamples });
  }, [activeSymbol, observed, sequence, tickTime]);

  const stored = intradayLog.get(activeSymbol)?.samples ?? [];
  const projected = observed !== null && (stored.length === 0 || stored[stored.length - 1].v !== observed)
    ? appendIntradaySample(stored, { t: tickTime, v: observed }, SAMPLE_LIMIT)
    : stored;
  const previousClose = derivePreviousClose(observed, active?.change ?? 0);
  const bounds = intradayBounds(projected.map((sample) => sample.v), [previousClose, observed]);
  const tone: "up" | "down" | "flat" = (active?.change ?? 0) > 0 ? "up" : (active?.change ?? 0) < 0 ? "down" : "flat";
  const closed = session === "closed";
  const dayHigh = projected.length > 0 ? Math.max(...projected.map((sample) => sample.v)) : null;
  const dayLow = projected.length > 0 ? Math.min(...projected.map((sample) => sample.v)) : null;
  const firstSample = projected[0];
  const lastSample = projected[projected.length - 1];
  const sessionMinute = minuteOfDayHKT(new Date(tickTime));
  const clampedMinute = Math.max(SESSION_TIMES.start, Math.min(SESSION_TIMES.end, sessionMinute));
  const elapsedMin = Math.max(0, clampedMinute - SESSION_TIMES.start);
  const progress = Math.round(sessionProgress(sessionMinute) * 100);

  return <section className="intraday-panel" aria-label={`${activeSymbol} intraday chart`}>
    <div className="intraday-head">
      <div className="intraday-title">
        <span>INTRADAY · ONE-DAY LIVE CHART</span>
        <h2>{activeSymbol} <small>{active?.label ?? ""}</small></h2>
      </div>
      <div className="intraday-switch" role="group" aria-label="Select index">
        {indices.map((index) => <button key={index.symbol} type="button" className={index.symbol === activeSymbol ? "is-active" : ""} aria-pressed={index.symbol === activeSymbol} onClick={() => setFocus(index.symbol)}>{index.symbol}</button>)}
      </div>
      <dl className="intraday-readout">
        <div><dt>LAST</dt><dd>{active?.value ?? "—"}</dd></div>
        <div><dt>CHANGE</dt><dd className={tone}>{active ? `${active.change >= 0 ? "+" : ""}${active.change.toFixed(2)}%` : "—"}</dd></div>
        <div><dt>PREV CLOSE</dt><dd>{previousClose !== null ? formatLevel(previousClose) : "—"}</dd></div>
        <div><dt>DAY RANGE</dt><dd>{dayHigh !== null && dayLow !== null ? `${formatLevel(dayLow)} – ${formatLevel(dayHigh)}` : "—"}</dd></div>
        <div><dt>TICKS</dt><dd>{projected.length} <i>· SINCE 09:30</i></dd></div>
      </dl>
    </div>
    <IntradayChart samples={projected} bounds={bounds} previousClose={previousClose} sessionMinute={clampedMinute} symbol={activeSymbol} tone={tone} />
    <div className="intraday-legend">
      <span className="dot-line" aria-hidden="true" /> Prev close reference
      <span className="dot-live" aria-hidden="true" /> Live tick
      <span className="dot-lunch" aria-hidden="true" /> Lunch break 12:00 – 13:00
    </div>
    <div className="intraday-timeline" role="img" aria-label={`Session ${progress}% complete`}>
      <span>09:30</span>
      <div className="intraday-track">
        <i className="intraday-lunch" />
        <b style={{ width: `${progress}%` }} />
      </div>
      <span>16:00</span>
    </div>
    <div className="intraday-foot">
      <span>{closed ? `${sessionLabel} · SHOWING LAST TRADING DAY` : sessionLabel} · HKEX CASH SESSION · {progress}% ELAPSED · {elapsedMin} MIN IN</span>
      {lastSample && firstSample && <span className={tone}>OPEN {formatLevel(firstSample.v)} · LAST {formatLevel(lastSample.v)} · Δ {formatLevel(lastSample.v - firstSample.v)}</span>}
      <span>{projected.length} TICK{projected.length === 1 ? "" : "S"} OBSERVED · DERIVED VIEW, DISPLAY ONLY</span>
    </div>
  </section>;
}

function IntradayChart({ samples, bounds, previousClose, sessionMinute, symbol, tone }: { samples: IntradaySample[]; bounds: IntradayBounds; previousClose: number | null; sessionMinute: number; symbol: string; tone: "up" | "down" | "flat" }) {
  if (samples.length === 0) {
    return <div className="intraday-empty">Collecting live intraday ticks for {symbol} — the line begins on the next feed update.</div>;
  }

  const width = 1000;
  const height = 320;
  const padY = 20;
  const padX = 16;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;

  const toX = (minute: number) => padX + sessionProgress(minute) * plotWidth;
  const toY = (value: number) => padY + (1 - (value - bounds.low) / bounds.span) * plotHeight;

  const points = samples.map((sample) => `${toX(minuteOfDayHKT(new Date(sample.t))).toFixed(2)},${toY(sample.v).toFixed(2)}`);
  const linePath = `M${points.join(" L")}`;

  // Anchor the fill on the previous close so gain/loss surface is intuitive.
  const baseline = previousClose !== null ? toY(previousClose) : toY(bounds.low);
  const firstX = toX(minuteOfDayHKT(new Date(samples[0].t)));
  const lastX = toX(minuteOfDayHKT(new Date(samples[samples.length - 1].t)));
  const areaPath = `${linePath} L${lastX.toFixed(2)},${baseline.toFixed(2)} L${firstX.toFixed(2)},${baseline.toFixed(2)} Z`;

  const guides = intradayLadder(bounds, 5);
  const previousY = previousClose !== null ? toY(previousClose) : null;

  const lunchStartX = toX(SESSION_TIMES.lunchStart);
  const lunchEndX = toX(SESSION_TIMES.lunchEnd);
  const nowX = toX(sessionMinute);

  const lastValue = samples[samples.length - 1].v;
  const lastY = toY(lastValue);

  const hourTicks = [10, 11, 12, 13, 14, 15, 16].map((hour) => hour * 60);

  return <div className="intraday-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${symbol} one-day intraday line chart from ${samples.length} observed ticks`}>
      <defs>
        <linearGradient id={`intraday-fill-${symbol}-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" className={`intraday-stop-${tone}`} stopOpacity="0.55" />
          <stop offset="100%" className={`intraday-stop-${tone}`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect className="intraday-lunch-band" x={lunchStartX} y={padY} width={Math.max(0, lunchEndX - lunchStartX)} height={plotHeight} />
      {guides.map((level, position) => <line key={`guide-${position}`} className="intraday-guide" x1={padX} x2={width - padX} y1={toY(level)} y2={toY(level)} />)}
      {hourTicks.map((minute) => <line key={`hour-${minute}`} className="intraday-hour" x1={toX(minute)} x2={toX(minute)} y1={padY} y2={height - padY} />)}
      {previousY !== null && <line className="intraday-prev" x1={padX} x2={width - padX} y1={previousY} y2={previousY} />}
      <path className={`intraday-area ${tone}`} d={areaPath} fill={`url(#intraday-fill-${symbol}-${tone})`} />
      <path className={`intraday-line ${tone}`} d={linePath} />
      <line className="intraday-cursor" x1={nowX} x2={nowX} y1={padY} y2={height - padY} />
      <g className={`intraday-marker ${tone}`}>
        <circle className="intraday-pulse" cx={lastX} cy={lastY} r="10" />
        <circle className="intraday-dot" cx={lastX} cy={lastY} r="4" />
      </g>
    </svg>
    <ul className="intraday-scale" aria-hidden="true">
      {guides.map((level, position) => <li key={`scale-${position}`}>{formatLevel(level)}</li>)}
    </ul>
    <ul className="intraday-hours" aria-hidden="true">
      <li>09:30</li><li>10:30</li><li>12:00</li><li>13:00</li><li>14:30</li><li>16:00</li>
    </ul>
  </div>;
}

function useTickTime(receivedAt: string, sequence: number) {
  const ref = useRef<{ key: string; time: number }>({ key: "", time: Date.now() });
  const key = `${sequence}:${receivedAt}`;
  if (ref.current.key !== key) {
    const parsed = Date.parse(receivedAt);
    ref.current = { key, time: Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now() };
  }
  return ref.current.time;
}

function formatLevel(value: number) {
  return new Intl.NumberFormat("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "auto" }).format(value);
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

