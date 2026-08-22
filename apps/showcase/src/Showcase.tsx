"use client";

import { useEffect, useState } from "react";
import { useMarketFeed } from "./market-feed";
import type { MarketIndex, MarketQuote } from "./market-data";
import { computeMarketPulse } from "./market-pulse";
import { appendSample, buildCandles, candleBounds, movingAverage, parseIndexValue, type Candle } from "./kline";
import "./showcase.css";

const SAMPLE_LIMIT = 180;
const SAMPLES_PER_CANDLE = 3;
const MA_SPAN = 5;

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
      <IndexKLine indices={market.indices} sequence={market.sequence} sessionLabel={sessionLabel} />
      <MarketPulseStrip quotes={quotes} />
      {edition === "baseline" ? <BaselineTable quotes={quotes} /> : <EnhancedMarket quotes={quotes} edition={edition} />}
      <footer className="market-footer"><span>DISPLAY ONLY · NOT INVESTMENT ADVICE</span><span>{market.source === "longbridge" ? "VERIFIED MARKET DATA" : advanced ? `FEATURE EDITION / ${edition.toUpperCase()}` : "BASELINE RELEASE / INTENTIONALLY SIMPLE"}</span></footer>
    </main>
  );
}

const tickLog = new Map<string, { key: string; values: number[] }>();

function IndexKLine({ indices, sequence, sessionLabel }: { indices: MarketIndex[]; sequence: number; sessionLabel: string }) {
  const [focus, setFocus] = useState("HSI");
  const active = indices.find((index) => index.symbol === focus) ?? indices[0] ?? null;
  const activeSymbol = active?.symbol ?? focus;
  const observed = parseIndexValue(active?.value ?? "");

  useEffect(() => {
    if (observed === null) return;
    const key = `${sequence}:${observed}`;
    const entry = tickLog.get(activeSymbol);
    if (entry?.key === key) return;
    tickLog.set(activeSymbol, { key, values: appendSample(entry?.values ?? [], observed, SAMPLE_LIMIT) });
  }, [activeSymbol, observed, sequence]);

  const logged = tickLog.get(activeSymbol);
  const samples = observed === null || logged?.key === `${sequence}:${observed}` ? logged?.values ?? [] : [...(logged?.values ?? []), observed];
  const candles = buildCandles(samples, SAMPLES_PER_CANDLE);
  const bounds = candleBounds(candles);
  const averages = movingAverage(candles, MA_SPAN);
  const previousClose = active && observed !== null && active.change !== -100 ? observed / (1 + active.change / 100) : null;
  const latest = candles.length > 0 ? candles[candles.length - 1] : null;
  const tone = (active?.change ?? 0) >= 0 ? "up" : "down";

  return <section className="kline-panel" aria-label={`${activeSymbol} candlestick chart`}>
    <div className="kline-head">
      <div className="kline-title">
        <span>K-LINE / OHLC FROM OBSERVED TICKS</span>
        <h2>{activeSymbol} <small>{active?.label ?? ""}</small></h2>
      </div>
      <div className="kline-switch" role="group" aria-label="Select index">
        {indices.map((index) => <button key={index.symbol} type="button" className={index.symbol === activeSymbol ? "is-active" : ""} aria-pressed={index.symbol === activeSymbol} onClick={() => setFocus(index.symbol)}>{index.symbol}</button>)}
      </div>
      <dl className="kline-readout">
        <div><dt>LAST</dt><dd>{active?.value ?? "—"}</dd></div>
        <div><dt>CHANGE</dt><dd className={tone}>{active ? `${active.change >= 0 ? "+" : ""}${active.change.toFixed(2)}%` : "—"}</dd></div>
        <div><dt>RANGE</dt><dd>{candles.length > 0 ? `${formatLevel(bounds.low)} – ${formatLevel(bounds.high)}` : "—"}</dd></div>
        <div><dt>BARS</dt><dd>{candles.length} <i>· {SAMPLES_PER_CANDLE} TICKS</i></dd></div>
      </dl>
    </div>
    <CandleChart candles={candles} bounds={bounds} averages={averages} previousClose={previousClose} symbol={activeSymbol} />
    <div className="kline-foot">
      <span>{sessionLabel} · MA{MA_SPAN} OVER CANDLE CLOSES</span>
      {latest && <span className={latest.close >= latest.open ? "up" : "down"}>LATEST BAR O {formatLevel(latest.open)} · H {formatLevel(latest.high)} · L {formatLevel(latest.low)} · C {formatLevel(latest.close)}</span>}
      <span>{samples.length} TICK{samples.length === 1 ? "" : "S"} OBSERVED · DERIVED VIEW, DISPLAY ONLY</span>
    </div>
  </section>;
}

function CandleChart({ candles, bounds, averages, previousClose, symbol }: { candles: Candle[]; bounds: ReturnType<typeof candleBounds>; averages: (number | null)[]; previousClose: number | null; symbol: string }) {
  if (candles.length === 0) return <div className="kline-empty">Collecting live ticks for {symbol} — the first candle opens on the next feed update.</div>;

  const width = 1000;
  const height = 300;
  const slot = width / Math.max(candles.length, 12);
  const bodyWidth = Math.max(2, Math.min(18, slot * 0.58));
  const toY = (value: number) => height - ((value - bounds.low) / bounds.span) * (height - 24) - 12;
  const centre = (index: number) => slot * (index + 0.5);
  const maPoints = averages
    .map((value, index) => (value === null ? null : `${centre(index).toFixed(2)},${toY(value).toFixed(2)}`))
    .filter((point): point is string => point !== null)
    .join(" ");
  const guides = [bounds.high, bounds.low + bounds.span / 2, bounds.low];
  const previousY = previousClose !== null && previousClose >= bounds.low && previousClose <= bounds.high ? toY(previousClose) : null;

  return <div className="kline-chart">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${symbol} candlestick chart built from ${candles.length} observed candles`}>
      {guides.map((level, position) => <line key={`guide-${position}`} className="kline-guide" x1={0} x2={width} y1={toY(level)} y2={toY(level)} />)}
      {previousY !== null && <line className="kline-prev" x1={0} x2={width} y1={previousY} y2={previousY} />}
      {candles.map((candle) => {
        const rising = candle.close >= candle.open;
        const top = toY(Math.max(candle.open, candle.close));
        const bottom = toY(Math.min(candle.open, candle.close));
        return <g key={candle.index} className={`kline-candle ${rising ? "rising" : "falling"}`}>
          <line x1={centre(candle.index)} x2={centre(candle.index)} y1={toY(candle.high)} y2={toY(candle.low)} />
          <rect x={centre(candle.index) - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1.5, bottom - top)} />
        </g>;
      })}
      {maPoints && <polyline className="kline-ma" points={maPoints} />}
    </svg>
    <ul className="kline-scale" aria-hidden="true">
      {guides.map((level, position) => <li key={`scale-${position}`}>{formatLevel(level)}</li>)}
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
