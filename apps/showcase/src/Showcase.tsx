"use client";

import { useEffect, useState } from "react";
import { MARKET_INDICES, MARKET_QUOTES, type MarketQuote } from "./market-data";
import { computeMarketPulse } from "./market-pulse";
import "./showcase.css";

type Edition = "baseline" | "sector-heatmap" | "momentum-lens" | "market-command";

export function Showcase() {
  const [edition, setEdition] = useState<Edition>("baseline");
  const [clock, setClock] = useState("13:42:08");

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

  const quotes = MARKET_QUOTES;
  const advanced = edition !== "baseline";

  return (
    <main className={`market-shell edition-${edition}`}>
      <header className="market-header">
        <div className="market-brand"><span>Q</span><div><b>MARKET PULSE / HK</b><small>Qoder Live Lab</small></div></div>
        <div className="market-session"><i /> AFTERNOON SESSION <b>{clock} HKT</b></div>
        <div className="feed-state"><span>{edition === "baseline" ? "MVP / DEMO FEED" : "DEMO FEED"}</span><small>Trusted data plane</small></div>
      </header>
      <section className="index-row">
        {MARKET_INDICES.map((index) => <article key={index.symbol}><div><span>{index.symbol}</span><small>{index.label}</small></div><strong>{index.value}</strong><b>+{index.change.toFixed(2)}%</b></article>)}
      </section>
      <MarketPulseStrip quotes={quotes} />
      {edition === "baseline" ? <BaselineTable quotes={quotes} /> : <EnhancedMarket quotes={quotes} edition={edition} />}
      <footer className="market-footer"><span>DISPLAY ONLY · NOT INVESTMENT ADVICE</span><span>{advanced ? `FEATURE EDITION / ${edition.toUpperCase()}` : "BASELINE RELEASE / INTENTIONALLY SIMPLE"}</span></footer>
    </main>
  );
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
  return <section className="baseline-panel"><div className="baseline-title"><div><div className="watchlist-row"><span>WATCHLIST / 6</span><ul className="tone-legend" aria-label="Change color legend"><li className="gain"><i />GAIN</li><li className="loss"><i />LOSS</li><li className="flat"><i />FLAT</li></ul></div><h1>Hong Kong<br />market monitor</h1></div><p>This baseline is intentionally simple.<br />Ask Qoder to make it useful.</p></div><div className="plain-table"><div className="table-head"><span>NAME</span><span>LAST</span><span>CHANGE</span><span>VOLUME</span></div>{quotes.map((quote) => <div className="table-row" key={quote.symbol}><span><b>{quote.symbol}</b>{quote.name}</span><strong>{quote.price.toFixed(2)}</strong><b className={quote.change >= 0 ? "up" : "down"}>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}%</b><span>{quote.volume}</span></div>)}</div></section>;
}

function EnhancedMarket({ quotes, edition }: { quotes: MarketQuote[]; edition: Exclude<Edition, "baseline"> }) {
  return <section className="enhanced-panel">
    <div className="enhanced-head"><div><span>MARKET TRANSFORMED</span><h1>{edition === "sector-heatmap" ? "Sector heatmap" : edition === "momentum-lens" ? "Momentum lens" : "Market command"}</h1></div>{edition === "market-command" && <div className="breadth"><span>MARKET BREADTH</span><strong>392 <i>UP</i> / 211 DOWN</strong></div>}</div>
    <div className="market-grid">{quotes.map((quote) => <MarketTile key={quote.symbol} quote={quote} showTrail={edition !== "sector-heatmap"} />)}</div>
    {edition === "market-command" && <div className="activity-tape"><b>LIVE ACTIVITY</b>{quotes.map((quote) => <span key={quote.symbol}>{quote.symbol} <i className={quote.change >= 0 ? "up" : "down"}>{quote.change >= 0 ? "▲" : "▼"} {Math.abs(quote.change).toFixed(2)}%</i></span>)}</div>}
  </section>;
}

function MarketTile({ quote, showTrail }: { quote: MarketQuote; showTrail: boolean }) {
  const points = quote.trail.map((value, index) => `${index * 11.1},${100 - value}`).join(" ");
  return <article className={`market-tile ${quote.change >= 0 ? "positive" : "negative"}`}><div className="tile-top"><span>{quote.symbol}</span><small>{quote.sector}</small></div><h2>{quote.name}</h2><div className="tile-price"><strong>{quote.price.toFixed(2)}</strong><b>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}%</b></div>{showTrail && <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${quote.name} momentum trail`}><polyline points={points} /></svg>}<div className="tile-volume">VOL {quote.volume}</div></article>;
}
