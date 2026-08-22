import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_QUOTES } from "../src/market-data";
import { beaufortForce, computeVolatilityField, forceLabel, intradayAmplitude } from "../src/volatility";

test("derives dispersion, gust and spread from the displayed watchlist only", () => {
  const field = computeVolatilityField(MARKET_QUOTES);
  const changes = MARKET_QUOTES.map((quote) => quote.change);
  assert.equal(field.cells.length, MARKET_QUOTES.length);
  assert.equal(field.dispersion, changes.reduce((sum, change) => sum + Math.abs(change), 0) / changes.length);
  assert.equal(field.gust, Math.max(...changes.map(Math.abs)));
  assert.equal(field.spread, Math.max(...changes) - Math.min(...changes));
  assert.equal(field.advancers + field.decliners + field.unchanged, MARKET_QUOTES.length);
});

test("ranks storm cells by absolute move without mutating the source", () => {
  const snapshot = MARKET_QUOTES.map((quote) => quote.symbol);
  const field = computeVolatilityField(MARKET_QUOTES);
  const absolute = field.cells.map((cell) => Math.abs(cell.change));
  assert.deepEqual(absolute, [...absolute].sort((left, right) => right - left));
  assert.equal(field.strongest?.symbol, "1810");
  assert.equal(field.calmest?.symbol, "1024");
  assert.equal(field.cells[0].energy, 1);
  assert.deepEqual(MARKET_QUOTES.map((quote) => quote.symbol), snapshot);
});

test("maps dispersion onto a bounded Beaufort force with a label", () => {
  assert.equal(beaufortForce(0), 0);
  assert.equal(beaufortForce(1.5), 3);
  assert.equal(beaufortForce(42), 9);
  assert.equal(forceLabel(0), "CALM");
  assert.equal(forceLabel(9), "HURRICANE FORCE");
  const field = computeVolatilityField(MARKET_QUOTES);
  assert.ok(field.intensity >= 10 && field.intensity <= 100);
  assert.equal(field.label, forceLabel(field.beaufort));
});

test("falls back to the displayed change when no intraday range is available", () => {
  const quote = MARKET_QUOTES[0];
  assert.equal(intradayAmplitude(quote), Math.abs(quote.change));
  assert.equal(
    intradayAmplitude({ ...quote, intraday: [
      { timestamp: "2026-08-21T01:30:00.000Z", price: 120, volume: 1, turnover: 1 },
      { timestamp: "2026-08-21T01:31:00.000Z", price: 126, volume: 1, turnover: 1 },
    ] }),
    ((126 - 120) / quote.previousClose) * 100,
  );
});

test("stays calm and honest for an empty watchlist", () => {
  const field = computeVolatilityField([]);
  assert.deepEqual(
    { cells: field.cells, dispersion: field.dispersion, beaufort: field.beaufort, label: field.label, strongest: field.strongest, calmest: field.calmest },
    { cells: [], dispersion: 0, beaufort: 0, label: "CALM", strongest: null, calmest: null },
  );
});
