"use client";

import { useEffect, useState } from "react";
import { MARKET_INDICES, MARKET_QUOTES, type MarketIndex, type MarketIntradayPoint, type MarketQuote } from "./market-data";

type FeedStatus = "live" | "delayed" | "stale" | "demo" | "offline";
type FeedMeta = {
  source: "longbridge" | "demo";
  providerLabel: string;
  status: FeedStatus;
  session: string;
  receivedAt: string;
  marketTimestamp: string;
  sequence: number;
};
type ApiQuote = {
  symbol: string;
  name: string;
  sector: string;
  last: number;
  prevClose: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  timestamp: string;
  trail: number[];
  intraday: MarketIntradayPoint[];
  featured?: boolean;
};
type ApiSnapshot = FeedMeta & { indices: ApiQuote[]; quotes: ApiQuote[] };
type ApiIntradaySnapshot = {
  symbol: string;
  vendorSymbol: string;
  tradingDay: string;
  receivedAt: string;
  sequence: number;
  points: MarketIntradayPoint[];
};
type ApiIntradayResponse =
  | { status: "pending"; symbol: string; vendorSymbol: string }
  | { status: "ready"; symbol: string; vendorSymbol: string; snapshot: ApiIntradaySnapshot };
export type MarketFeedView = FeedMeta & { indices: MarketIndex[]; quotes: MarketQuote[]; universeQuotes: MarketQuote[] };

const initialView: MarketFeedView = {
  source: "demo",
  providerLabel: "DEMO SNAPSHOT",
  status: "demo",
  session: "afternoon",
  receivedAt: new Date().toISOString(),
  marketTimestamp: new Date().toISOString(),
  sequence: 0,
  indices: MARKET_INDICES,
  quotes: MARKET_QUOTES,
  universeQuotes: MARKET_QUOTES,
};

export function useMarketFeed() {
  const [market, setMarket] = useState(initialView);

  useEffect(() => {
    let active = true;
    const endpoint = controlEndpoint("/api/market");

    const refresh = async () => {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Market feed returned ${response.status}`);
        const snapshot = await response.json() as ApiSnapshot;
        if (!active || !validSnapshot(snapshot)) return;
        setMarket(toView(snapshot));
      } catch {
        if (!active) return;
        setMarket((current) => current.source === "longbridge" ? { ...current, status: "stale" } : current);
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return market;
}

export function useMarketIntraday(symbol: string) {
  const [resolved, setResolved] = useState<{ symbol: string; snapshot: ApiIntradaySnapshot }>();

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    let pollTimer: number | undefined;

    const apply = (response: ApiIntradayResponse) => {
      if (!active || response.status !== "ready") return false;
      setResolved({ symbol: response.symbol, snapshot: response.snapshot });
      return true;
    };

    const request = async () => {
      try {
        const response = await fetch(controlEndpoint("/api/market/intraday"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        if (response.ok) apply(await response.json() as ApiIntradayResponse);
      } catch { /* the last verified line remains visible */ }
    };

    const refresh = async () => {
      let ready = false;
      try {
        const response = await fetch(`${controlEndpoint("/api/market/intraday")}?symbol=${encodeURIComponent(symbol)}`);
        if (response.ok) ready = apply(await response.json() as ApiIntradayResponse);
      } catch { /* retry below */ }
      if (active) pollTimer = window.setTimeout(refresh, ready ? 20_000 : 1_500);
    };

    void request().finally(refresh);
    const keepAlive = window.setInterval(request, 5 * 60_000);
    return () => {
      active = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      window.clearInterval(keepAlive);
    };
  }, [symbol]);

  return resolved?.symbol === symbol ? resolved.snapshot : undefined;
}

function toView(snapshot: ApiSnapshot): MarketFeedView {
  const allQuotes = snapshot.source === "longbridge" ? snapshot.quotes.map((quote) => ({
    symbol: quote.symbol,
    name: quote.name,
    sector: quote.sector,
    price: quote.last,
    previousClose: quote.prevClose,
    change: quote.changePercent,
    volume: compactNumber(quote.volume),
    trail: quote.trail.length > 1 ? quote.trail : [quote.open, quote.last],
    open: quote.open,
    high: quote.high,
    low: quote.low,
    timestamp: quote.timestamp,
    intraday: quote.intraday ?? [],
    featured: quote.featured,
  })) : MARKET_QUOTES;
  return {
    source: snapshot.source,
    providerLabel: snapshot.providerLabel,
    status: snapshot.status,
    session: snapshot.session,
    receivedAt: snapshot.receivedAt,
    marketTimestamp: snapshot.marketTimestamp,
    sequence: snapshot.sequence,
    indices: snapshot.source === "longbridge" ? snapshot.indices.map((quote) => ({
      symbol: quote.symbol,
      label: quote.name,
      value: formatPrice(quote.last),
      last: quote.last,
      previousClose: quote.prevClose,
      change: quote.changePercent,
      intraday: quote.intraday ?? [],
    })) : MARKET_INDICES,
    quotes: allQuotes.filter((quote) => quote.featured !== false),
    universeQuotes: allQuotes,
  };
}

function controlEndpoint(path: string) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return window.location.port === "4173" ? `http://localhost:3000${path}` : `${window.location.origin}${path}`;
  }
  return `https://qoder-live-lab.vercel.app${path}`;
}

function validSnapshot(value: ApiSnapshot) {
  return value && ["longbridge", "demo"].includes(value.source) && Array.isArray(value.quotes) && Array.isArray(value.indices) && typeof value.receivedAt === "string";
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value).toUpperCase();
}
