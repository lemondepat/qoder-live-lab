"use client";

import { useEffect, useState } from "react";
import { useMarketFeed, useMarketIntraday } from "./market-feed";
import type { MarketIndex, MarketQuote } from "./market-data";
import { computeMarketPulse } from "./market-pulse";
import { VolatilityWeatherMap } from "./volatility-storm-map";
import { SectorHeatmapBoard } from "./sector-heatmap-board";
import { anchorSeries, appendPoint, clampToSession, formatMinute, hongKongMinute, hongKongTradingDay, intradayExtremes, intradaySpan, linePath, areaPath, observationScope, percentFrom, priceLevels, runningAverage, SESSION, sessionProgress, timeLevels, tradedMinutes, TRADED_MINUTES, trustedIntradaySeries, type IntradayPoint, type IntradaySpan } from "./intraday";
import { indexInstrument, resolveActive, scopeInstruments, stockInstrument, type IntradayInstrument, type IntradayScope } from "./intraday-scope";
import { lookupInstrument, normalizeCode, rememberCode, searchInstruments, type SymbolLookup } from "./symbol-lookup";
import "./showcase.css";

const POINT_LIMIT = 390;

type Theme = "dark" | "light";

function ThemeToggle({ theme, onTheme }: { theme: Theme; onTheme: (next: Theme) => void }) {
  const light = theme === "light";
  return <button type="button" className="theme-toggle" aria-pressed={light}
    aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
    title={light ? "Switch to dark mode" : "Switch to light mode"}
    onClick={() => onTheme(light ? "dark" : "light")}>
    <i aria-hidden="true" /><b>{light ? "LIGHT" : "DARK"}</b>
  </button>;
}

export function RichShowcase() {
  const [clock, setClock] = useState("13:42:08");
  const [sizing, setSizing] = useState<"turnover" | "equal">("turnover");
  const [theme, setTheme] = useState<Theme>("dark");
  const market = useMarketFeed();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).format(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const quotes = market.quotes;
  const feedTitle = market.status === "live" && market.session === "closed" ? "MARKET CLOSED · LIVE FEED" : market.status === "live" ? "LIVE MARKET FEED" : market.status === "stale" ? "STALE · LAST GOOD TICK" : market.status === "delayed" ? "DELAYED MARKET FEED" : "DEMO · AWAITING LIVE FEED";
  const feedDetail = market.source === "longbridge" ? `${market.session.toUpperCase()} · SEQ ${market.sequence}` : "Trusted data plane ready";
  const sessionLabel = market.session === "closed" ? "MARKET CLOSED" : `${market.session.toUpperCase()} SESSION`;

  return (
    <main className="market-shell edition-baseline">
      <header className="market-header">
        <div className="market-brand"><span className="qoder-brand-icon" aria-hidden="true" /><div><b>HONG KONG MARKET PULSE</b><small>Built · verified · deployed by Qoder</small></div></div>
        <div className="market-session"><i className={market.status === "live" ? "is-live" : ""} /> {sessionLabel} <b>{clock} HKT</b></div>
        <div className={`feed-state feed-${market.status}`}><span>{feedTitle}</span><small>{feedDetail}</small></div>
        <ThemeToggle theme={theme} onTheme={setTheme} />
      </header>
      <VolatilityWeatherMap quotes={quotes} sessionLabel={sessionLabel} clock={clock} status={market.status} />
      <section className="index-row">
        {market.indices.map((index) => <article key={`${index.symbol}-${market.sequence}`}><div><span>{index.symbol}</span><small>{index.label}</small></div><strong>{index.value}</strong><b className={index.change >= 0 ? "up" : "down"}>{index.change >= 0 ? "+" : ""}{index.change.toFixed(2)}%</b></article>)}
      </section>
      <IntradayPanel indices={market.indices} quotes={quotes} universeQuotes={market.universeQuotes} sequence={market.sequence} sessionLabel={sessionLabel} session={market.session} marketTimestamp={market.marketTimestamp} status={market.status} source={market.source} />
      <MarketPulseStrip quotes={quotes} />
      <div className="watchlist-row"><span>WATCHLIST / {quotes.length}</span><ul className="tone-legend" aria-label="Change color legend"><li className="gain"><i />GAIN</li><li className="loss"><i />LOSS</li><li className="flat"><i />FLAT</li></ul></div>
      <SectorHeatmapBoard quotes={quotes} sessionLabel={sessionLabel} clock={clock} status={market.status} mode={sizing} onMode={setSizing} />
      <footer className="market-footer"><span>DISPLAY ONLY · NOT INVESTMENT ADVICE</span><span>{market.status === "live" ? "VERIFIED MARKET DATA" : "BASELINE RELEASE / INTENTIONALLY SIMPLE"}</span></footer>
    </main>
  );
}

const tickTrack = new Map<string, { key: string; points: IntradayPoint[] }>();

function IntradayPanel({ indices, quotes, universeQuotes, sequence, sessionLabel, session, marketTimestamp, status, source }: { indices: MarketIndex[]; quotes: MarketQuote[]; universeQuotes: MarketQuote[]; sequence: number; sessionLabel: string; session: string; marketTimestamp: string; status: string; source: string }) {
  const [scope, setScope] = useState<IntradayScope>("index");
  const [focusByScope, setFocusByScope] = useState<Record<IntradayScope, string>>({ index: "HSI", stock: "" });
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<SymbolLookup>({ state: "idle" });
  const [history, setHistory] = useState<string[]>([]);
  const universe = [...indices.map(indexInstrument), ...universeQuotes.map(stockInstrument)];
  const instruments = scopeInstruments(scope, indices, universeQuotes);
  const quickInstruments = scopeInstruments(scope, indices, quotes);
  const active = resolveActive(instruments, focusByScope[scope]);
  const activeSymbol = active?.symbol ?? focusByScope[scope];
  const requestedIntraday = useMarketIntraday(activeSymbol);
  const observed = active?.last ?? null;
  const stamped = new Date(marketTimestamp);
  const instant = Number.isNaN(stamped.getTime()) ? new Date() : stamped;
  const tradingDay = hongKongTradingDay(instant);
  const minute = clampToSession(hongKongMinute(instant));
  const trackScope = observationScope(source, tradingDay, `${scope}:${activeSymbol}`);
  const providerPoints = trustedIntradaySeries(requestedIntraday?.points ?? active?.intraday ?? [], tradingDay);
  const hasOfficialMinutes = providerPoints.length > 0;

  const setFocus = (symbol: string) => setFocusByScope((current) => ({ ...current, [scope]: symbol }));

  const focusInstrument = (instrument: IntradayInstrument) => {
    setScope(instrument.kind);
    setFocusByScope((current) => ({ ...current, [instrument.kind]: instrument.symbol }));
    setHistory((current) => rememberCode(current, instrument.symbol));
    setLookup({ state: "resolved", instrument });
    setQuery("");
  };

  const submitQuery = () => {
    const result = lookupInstrument(universe, query);
    if (result.state === "resolved") focusInstrument(result.instrument);
    else setLookup(result);
  };

  const typed = normalizeCode(query);
  const hints = searchInstruments(universe, query, 5);

  useEffect(() => {
    if (observed === null || hasOfficialMinutes) return;
    const key = `${trackScope}:${sequence}:${observed}`;
    const entry = tickTrack.get(trackScope);
    if (entry?.key === key) return;
    tickTrack.set(trackScope, { key, points: appendPoint(entry?.points ?? [], { minute, value: observed }, POINT_LIMIT) });
  }, [trackScope, observed, sequence, minute, hasOfficialMinutes]);

  const tracked = tickTrack.get(trackScope);
  const observedPoints = observed === null || tracked?.key === `${trackScope}:${sequence}:${observed}`
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
  const scopeNoun = scope === "stock" ? "STOCK" : "INDEX";

  return <section className={`intraday-panel tone-${tone}`} aria-label={`${activeSymbol} one day intraday chart`}>
    <div className="intraday-scope" role="tablist" aria-label="Intraday chart scope">
      <button type="button" role="tab" className={scope === "index" ? "is-active" : ""} aria-selected={scope === "index"} onClick={() => setScope("index")}>INDICES</button>
      <button type="button" role="tab" className={scope === "stock" ? "is-active" : ""} aria-selected={scope === "stock"} onClick={() => setScope("stock")}>STOCKS</button>
    </div>
    <div className="symbol-search">
      <form className="symbol-form" role="search" onSubmit={(event) => { event.preventDefault(); submitQuery(); }}>
        <label htmlFor="symbol-input">CHART 100 HK STOCKS</label>
        <div className="symbol-field">
          <input id="symbol-input" type="text" inputMode="text" autoComplete="off" spellCheck={false} placeholder="e.g. 700, 1810.HK, XIAOMI, HSTECH"
            value={query} aria-describedby="symbol-help"
            onChange={(event) => { setQuery(event.target.value); setLookup({ state: "idle" }); }}
            onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); setLookup({ state: "idle" }); } }} />
          {typed.length > 0 && <em className="symbol-normalized">→ {typed}</em>}
          <button type="submit">CHART</button>
        </div>
        <small id="symbol-help">Code, name or sector · matched against {universe.length} trusted market instruments</small>
      </form>
      {hints.length > 0 && <ul className="symbol-hints" aria-label="Matching instruments">
        {hints.map((hint) => <li key={`${hint.kind}-${hint.symbol}`}>
          <button type="button" onClick={() => focusInstrument(hint)}>
            <b>{hint.symbol}</b><span>{hint.label}</span><i className={hint.change >= 0 ? "up" : "down"}>{hint.change >= 0 ? "+" : ""}{hint.change.toFixed(2)}%</i><u>{hint.kind === "index" ? "INDEX" : "STOCK"}</u>
          </button>
        </li>)}
      </ul>}
      {lookup.state === "unknown" && <p className="symbol-miss" role="status">
        <b>{lookup.code}</b> is not published by the trusted feed, so nothing is charted for it. Try {lookup.suggestions.map((entry) => entry.symbol).join(" · ")}.
      </p>}
      {history.length > 0 && <div className="symbol-recent"><span>RECENT</span>{history.map((code) => {
        const entry = universe.find((instrument) => instrument.symbol === code);
        return entry ? <button key={`recent-${code}`} type="button" className={code === activeSymbol ? "is-active" : ""} onClick={() => focusInstrument(entry)}>{code}</button> : null;
      })}</div>}
    </div>
    <div className="intraday-head">
      <div className="intraday-title">
        <span>INTRADAY · 1 DAY · {scopeNoun} · {hasOfficialMinutes ? "OFFICIAL MINUTE BARS" : "LIVE LINE FROM OBSERVED TICKS"}</span>
        <h2>{activeSymbol} <small>{active?.label ?? ""}</small></h2>
        {active?.meta && <em className="intraday-meta">{active.meta}</em>}
      </div>
      <div className="intraday-switch" role="group" aria-label={`Select ${scopeNoun.toLowerCase()}`}>
        {quickInstruments.map((instrument) => <button key={instrument.symbol} type="button" className={instrument.symbol === activeSymbol ? "is-active" : ""} aria-pressed={instrument.symbol === activeSymbol} onClick={() => setFocus(instrument.symbol)}>
          <b>{instrument.symbol}</b><i className={instrument.change >= 0 ? "up" : "down"}>{instrument.change >= 0 ? "+" : ""}{instrument.change.toFixed(2)}%</i>
        </button>)}
      </div>
      <dl className="intraday-readout">
        <div><dt>LAST</dt><dd>{active?.displayValue ?? "—"}</dd></div>
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
