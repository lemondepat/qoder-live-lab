import assert from "node:assert/strict";
import test from "node:test";
import type { MarketIndex, MarketQuote } from "../src/market-data";
import { indexInstrument, resolveActive, scopeInstruments, stockInstrument } from "../src/intraday-scope";

const index: MarketIndex = { symbol: "HSI", label: "Hang Seng", value: "25,412.80", last: 25412.8, previousClose: 25200.71, change: 0.84, intraday: [] };
const quote: MarketQuote = { symbol: "9988", name: "Alibaba", sector: "Internet", price: 124.8, previousClose: 121.9, change: 2.38, volume: "48.2M", trail: [], intraday: [] };

test("normalizes an index into a chartable instrument", () => {
  const instrument = indexInstrument(index);
  assert.equal(instrument.kind, "index");
  assert.equal(instrument.symbol, "HSI");
  assert.equal(instrument.displayValue, "25,412.80");
  assert.equal(instrument.last, 25412.8);
  assert.equal(instrument.previousClose, 25200.71);
  assert.equal(instrument.meta, null);
});

test("normalizes an equity quote into a chartable instrument with meta", () => {
  const instrument = stockInstrument(quote);
  assert.equal(instrument.kind, "stock");
  assert.equal(instrument.symbol, "9988");
  assert.equal(instrument.label, "Alibaba");
  assert.equal(instrument.last, 124.8);
  assert.equal(instrument.previousClose, 121.9);
  assert.equal(instrument.meta, "Internet · VOL 48.2M");
  assert.equal(instrument.intraday, quote.intraday);
});

test("selects instruments by scope while preserving feed order", () => {
  const indices = scopeInstruments("index", [index], [quote]);
  assert.deepEqual(indices.map((entry) => entry.symbol), ["HSI"]);
  const stocks = scopeInstruments("stock", [index], [quote]);
  assert.deepEqual(stocks.map((entry) => entry.symbol), ["9988"]);
  assert.ok(stocks.every((entry) => entry.kind === "stock"));
});

test("resolves the focused instrument and falls back to the first", () => {
  const instruments = scopeInstruments("stock", [index], [quote]);
  assert.equal(resolveActive(instruments, "9988")?.symbol, "9988");
  assert.equal(resolveActive(instruments, "missing")?.symbol, "9988");
  assert.equal(resolveActive([], "9988"), null);
});
