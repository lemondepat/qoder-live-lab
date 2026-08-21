import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_QUOTES } from "../src/market-data";
import { computeMarketPulse } from "../src/market-pulse";

test("derives breadth counts from the displayed watchlist only", () => {
  const pulse = computeMarketPulse(MARKET_QUOTES);
  assert.equal(pulse.total, MARKET_QUOTES.length);
  assert.equal(pulse.advancers + pulse.decliners + pulse.unchanged, MARKET_QUOTES.length);
  assert.equal(pulse.advancers, MARKET_QUOTES.filter((quote) => quote.change > 0).length);
  assert.equal(pulse.decliners, MARKET_QUOTES.filter((quote) => quote.change < 0).length);
  assert.equal(pulse.advancerShare, Math.round((pulse.advancers / pulse.total) * 100));
});

test("ranks leader and laggard by displayed change without mutating the source", () => {
  const snapshot = MARKET_QUOTES.map((quote) => quote.symbol);
  const pulse = computeMarketPulse(MARKET_QUOTES);
  assert.equal(pulse.leader?.symbol, "1810");
  assert.equal(pulse.laggard?.symbol, "1211");
  assert.deepEqual(MARKET_QUOTES.map((quote) => quote.symbol), snapshot);
});

test("averages the displayed change values", () => {
  const expected = MARKET_QUOTES.reduce((carry, quote) => carry + quote.change, 0) / MARKET_QUOTES.length;
  assert.equal(computeMarketPulse(MARKET_QUOTES).averageChange, expected);
});

test("stays neutral for an empty watchlist", () => {
  const pulse = computeMarketPulse([]);
  assert.deepEqual(
    { total: pulse.total, advancerShare: pulse.advancerShare, averageChange: pulse.averageChange, leader: pulse.leader, laggard: pulse.laggard },
    { total: 0, advancerShare: 0, averageChange: 0, leader: null, laggard: null },
  );
});
