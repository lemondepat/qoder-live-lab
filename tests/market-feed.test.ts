import assert from "node:assert/strict";
import test from "node:test";
import { buildSnapshot, marketSession, mergeIntraday, mergeLiveIntraday, mergeQuote, normalizeIntraday } from "../apps/runner/src/market-feed";
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
  assert.deepEqual(quote?.intraday, []);
  assert.ok((quote?.changePercent ?? 0) > 1);
});

test("folds official Longbridge minute bars into the trusted quote contract", () => {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(quotes, { symbol: "HSI.HK", last_done: "26009.46", prev_close: "25849.08", timestamp: "2026-08-21T08:00:00Z" });
  const count = mergeIntraday(quotes, "HSI.HK", [
    { price: "25860.10", timestamp: "2026-08-21T01:31:00Z", volume: "12", turnover: "310321.2", avg_price: "25858.2" },
    { price: "25856.51", timestamp: "2026-08-21T01:30:00Z", volume: "10", turnover: "258565.1", avg_price: "25856.51" },
  ]);
  const quote = quotes.get("HSI.HK");
  assert.equal(count, 2);
  assert.deepEqual(quote?.intraday.map((point) => point.price), [25856.51, 25860.1]);
  assert.equal(quote?.intraday[0]?.averagePrice, 25856.51);
  assert.deepEqual(quote?.trail, [25856.51, 25860.1]);
});

test("extends the current minute from shared quote pushes without polling the full day", () => {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(quotes, { symbol: "700.HK", last_done: "448.60", prev_close: "442.40", volume: 1_000, turnover: 448_600, timestamp: "2026-08-26T05:51:00Z" });

  applyTick(quotes, { symbol: "700.HK", last_done: "448.70", volume: 1_060, turnover: 475_522, current_volume: 60, current_turnover: 26_922, timestamp: "2026-08-26T05:51:31Z" });
  applyTick(quotes, { symbol: "700.HK", last_done: "448.80", volume: 1_090, turnover: 488_986, current_volume: 30, current_turnover: 13_464, timestamp: "2026-08-26T05:51:52Z" });
  applyTick(quotes, { symbol: "700.HK", last_done: "448.90", volume: 1_120, turnover: 502_453, current_volume: 30, current_turnover: 13_467, timestamp: "2026-08-26T05:52:04Z" });

  const intraday = quotes.get("700.HK")?.intraday ?? [];
  assert.equal(intraday.length, 2);
  assert.deepEqual(intraday.map((point) => point.timestamp), ["2026-08-26T05:51:00.000Z", "2026-08-26T05:52:00.000Z"]);
  assert.equal(intraday[0]?.price, 448.8);
  assert.equal(intraday[0]?.volume, 90);
  assert.equal(intraday[1]?.volume, 30);
});

test("deduplicates a replayed tick by using cumulative quote totals", () => {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(quotes, { symbol: "700.HK", last_done: "448.60", prev_close: "442.40", volume: 1_000, turnover: 448_600, timestamp: "2026-08-26T05:51:00Z" });
  const tick = { symbol: "700.HK", last_done: "448.70", volume: 1_060, turnover: 475_522, current_volume: 60, current_turnover: 26_922, timestamp: "2026-08-26T05:51:31Z" };
  applyTick(quotes, tick);
  applyTick(quotes, tick);
  applyTick(quotes, { ...tick, volume: 1_050, turnover: 471_000, current_volume: 50, current_turnover: 22_400 });
  assert.equal(quotes.get("700.HK")?.intraday[0]?.volume, 60);
  assert.equal(quotes.get("700.HK")?.intraday[0]?.turnover, 26_922);
  assert.equal(quotes.get("700.HK")?.volume, 1_060);
});

test("keeps a live head while reconnect backfill fills the preceding gap", () => {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(quotes, { symbol: "HSI.HK", last_done: "25862", prev_close: "25800", volume: 100, timestamp: "2026-08-21T01:32:10Z" });
  mergeIntraday(quotes, "HSI.HK", [
    { price: "25856", timestamp: "2026-08-21T01:30:00Z", volume: "10", turnover: "258560" },
    { price: "25860", timestamp: "2026-08-21T01:31:00Z", volume: "12", turnover: "310320" },
  ]);
  const beforeTick = quotes.get("HSI.HK");
  mergeQuote(quotes, { symbol: "HSI.HK", last_done: "25863", volume: 105, current_volume: 5, timestamp: "2026-08-21T01:32:20Z" });
  mergeLiveIntraday(quotes, { symbol: "HSI.HK", last_done: "25863", volume: 105, current_volume: 5, timestamp: "2026-08-21T01:32:20Z" }, beforeTick);

  mergeIntraday(quotes, "HSI.HK", [
    { price: "25856", timestamp: "2026-08-21T01:30:00Z", volume: "10", turnover: "258560" },
    { price: "25860", timestamp: "2026-08-21T01:31:00Z", volume: "12", turnover: "310320" },
  ]);
  assert.deepEqual(quotes.get("HSI.HK")?.intraday.map((point) => point.price), [25856, 25860, 25863]);
});

test("starts a clean intraday track when the first tick belongs to a new trading day", () => {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  mergeQuote(quotes, { symbol: "700.HK", last_done: "448", prev_close: "442", volume: 10_000, timestamp: "2026-08-25T08:00:00Z" });
  mergeIntraday(quotes, "700.HK", [{ price: "448", timestamp: "2026-08-25T08:00:00Z", volume: "10", turnover: "4480" }]);
  const previous = quotes.get("700.HK");
  mergeQuote(quotes, { symbol: "700.HK", last_done: "450", prev_close: "448", volume: 50, current_volume: 50, timestamp: "2026-08-26T01:30:05Z" });
  mergeLiveIntraday(quotes, { symbol: "700.HK", last_done: "450", volume: 50, current_volume: 50, timestamp: "2026-08-26T01:30:05Z" }, previous);
  assert.deepEqual(quotes.get("700.HK")?.intraday.map((point) => point.timestamp), ["2026-08-26T01:30:00.000Z"]);
});

test("normalizes, deduplicates, and rejects malformed intraday facts", () => {
  const points = normalizeIntraday([
    { price: "0", timestamp: "2026-08-21T01:29:00Z" },
    { price: "100", timestamp: "not-a-date" },
    { price: "101", timestamp: "2026-08-21T01:30:00Z", volume: "4", turnover: "404" },
    { price: "102", timestamp: "2026-08-21T01:30:00Z", volume: "5", turnover: "510" },
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0]?.price, 102);
  assert.equal(points[0]?.volume, 5);
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

function applyTick(quotes: Map<string, MarketQuoteSnapshot>, raw: Record<string, unknown> & { symbol: string }) {
  const previous = quotes.get(raw.symbol);
  assert.equal(mergeQuote(quotes, raw), true);
  assert.equal(mergeLiveIntraday(quotes, raw, previous), true);
}
