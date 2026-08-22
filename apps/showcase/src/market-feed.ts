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
};
type ApiSnapshot = FeedMeta & { indices: ApiQuote[]; quotes: ApiQuote[] };
export type MarketFeedView = FeedMeta & { indices: MarketIndex[]; quotes: MarketQuote[] };

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
};

export function useMarketFeed() {
  const [market, setMarket] = useState(initialView);

  useEffect(() => {
    let active = true;
    const endpoint = window.location.hostname === "localhost"
      ? "http://localhost:3000/api/market"
      : "https://qoder-live-lab.vercel.app/api/market";

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

function toView(snapshot: ApiSnapshot): MarketFeedView {
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
    quotes: snapshot.source === "longbridge" ? snapshot.quotes.map((quote) => ({
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
      })) : MARKET_QUOTES,
  };
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
