import assert from "node:assert/strict";
import test from "node:test";
import { buildSnapshot, marketSession, mergeQuote } from "../apps/runner/src/market-feed";
import type { MarketQuoteSnapshot } from "@qoder-live-lab/contracts";

test("folds Longbridge snapshots and ticks into trusted quote facts", () => {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(quotes, { symbol: "700.HK", last_done: "448.600", prev_close: "442.400", open: "438.200", high: "450.000", low: "437.800", volume: 12_441_624, turnover: "5570000000", timestamp: "2026-08-26T05:51:30Z" });
  mergeQuote(quotes, { symbol: "700.HK", last_done: "448.700", volume: 12_442_224, timestamp: "2026-08-26T05:51:31Z" });
  const quote = quotes.get("700.HK");
  assert.equal(quote?.symbol, "0700");
  assert.equal(quote?.last, 448.7);
  assert.equal(quote?.prevClose, 442.4);
  assert.equal(quote?.trail.at(-1), 448.7);
  assert.ok((quote?.changePercent ?? 0) > 1);
});

test("ignores an out-of-order push instead of moving the market backwards", () => {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(quotes, { symbol: "9988.HK", last_done: "125", prev_close: "123", timestamp: "2026-08-26T05:51:31Z" });
  mergeQuote(quotes, { symbol: "9988.HK", last_done: "110", timestamp: "2026-08-26T05:50:00Z" });
  assert.equal(quotes.get("9988.HK")?.last, 125);
});

test("builds a public snapshot with indices separated from equities", () => {
  const values = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(values, { symbol: "HSI.HK", last_done: "25412.8", prev_close: "25200", timestamp: "2026-08-26T05:30:00Z" });
  mergeQuote(values, { symbol: "700.HK", last_done: "448.6", prev_close: "442.4", timestamp: "2026-08-26T05:30:01Z" });
  const snapshot = buildSnapshot([...values.values()], 4, new Date("2026-08-26T05:30:02Z"));
  assert.equal(snapshot.session, "afternoon");
  assert.equal(snapshot.indices[0]?.symbol, "HSI");
  assert.equal(snapshot.quotes[0]?.symbol, "0700");
  assert.equal(snapshot.sequence, 4);
});

test("labels an old quote timestamp as delayed during an active session", () => {
  const values = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(values, { symbol: "700.HK", last_done: "448.6", prev_close: "442.4", timestamp: "2026-08-26T05:20:00Z" });
  const snapshot = buildSnapshot([...values.values()], 5, new Date("2026-08-26T05:30:00Z"));
  assert.equal(snapshot.status, "delayed");
});

test("uses the official Hong Kong market session windows", () => {
  assert.equal(marketSession(new Date("2026-08-26T01:45:00Z")), "morning");
  assert.equal(marketSession(new Date("2026-08-26T04:30:00Z")), "lunch");
  assert.equal(marketSession(new Date("2026-08-26T05:30:00Z")), "afternoon");
  assert.equal(marketSession(new Date("2026-08-22T05:30:00Z")), "closed");
});
