import assert from "node:assert/strict";
import test from "node:test";
import { appendSample, axisLevels, buildCandles, candleBounds, composeSeries, derivePreviousClose, movingAverage, paddedBounds, parseIndexValue } from "../src/kline";

test("parses formatted index values and rejects junk", () => {
  assert.equal(parseIndexValue("25,412.80"), 25412.8);
  assert.equal(parseIndexValue("5678.31"), 5678.31);
  assert.equal(parseIndexValue(""), null);
  assert.equal(parseIndexValue("n/a"), null);
});

test("keeps the observed sample tail bounded", () => {
  const history = [1, 2, 3];
  assert.deepEqual(appendSample(history, 4, 5), [1, 2, 3, 4]);
  assert.deepEqual(appendSample(history, 4, 3), [2, 3, 4]);
  assert.deepEqual(history, [1, 2, 3]);
});

test("groups observed samples into OHLC candles including the partial tail", () => {
  const candles = buildCandles([10, 12, 9, 11, 14, 13, 15], 3);
  assert.equal(candles.length, 3);
  assert.deepEqual(candles[0], { index: 0, open: 10, close: 9, high: 12, low: 9, samples: 3 });
  assert.deepEqual(candles[1], { index: 1, open: 11, close: 13, high: 14, low: 11, samples: 3 });
  assert.deepEqual(candles[2], { index: 2, open: 15, close: 15, high: 15, low: 15, samples: 1 });
});

test("stays empty without samples and neutral for bounds", () => {
  assert.deepEqual(buildCandles([], 4), []);
  assert.deepEqual(candleBounds([]), { low: 0, high: 0, span: 1 });
});

test("derives bounds with a non-zero span for flat candles", () => {
  const flat = candleBounds(buildCandles([20, 20, 20], 1));
  assert.deepEqual(flat, { low: 20, high: 20, span: 1 });
  const bounds = candleBounds(buildCandles([20, 26, 18, 22], 2));
  assert.deepEqual(bounds, { low: 18, high: 26, span: 8 });
});

test("averages candle closes only once the span is filled", () => {
  const candles = buildCandles([10, 20, 30, 40], 1);
  assert.deepEqual(movingAverage(candles, 2), [null, 15, 25, 35]);
  assert.deepEqual(movingAverage(candles, 1), [10, 20, 30, 40]);
});

test("seeds the series with the previous close so a chart exists from the first tick", () => {
  assert.deepEqual(composeSeries(100, [102]), [100, 102]);
  assert.deepEqual(composeSeries(null, [102]), [102]);
  assert.deepEqual(composeSeries(100, []), [100]);
});

test("derives the previous close from the reported change percent", () => {
  assert.ok(Math.abs((derivePreviousClose(110, 10) ?? 0) - 100) < 1e-9);
  assert.equal(derivePreviousClose(100, 0), 100);
  assert.equal(derivePreviousClose(null, 5), null);
  assert.equal(derivePreviousClose(100, -100), null);
});

test("pads the domain so wicks and reference lines stay inside the plot", () => {
  const bounds = paddedBounds({ low: 100, high: 200, span: 100 }, [], 0.1);
  assert.deepEqual(bounds, { low: 90, high: 210, span: 120 });
  const withExtras = paddedBounds({ low: 100, high: 200, span: 100 }, [250, null], 0);
  assert.deepEqual(withExtras, { low: 100, high: 250, span: 150 });
  const flat = paddedBounds({ low: 50, high: 50, span: 1 }, [], 0.1);
  assert.ok(flat.low < 50 && flat.high > 50 && flat.span > 0);
});

test("spreads axis levels evenly from high to low", () => {
  assert.deepEqual(axisLevels({ low: 0, high: 100, span: 100 }, 5), [100, 75, 50, 25, 0]);
  assert.deepEqual(axisLevels({ low: 0, high: 10, span: 10 }, 1), [10, 0]);
});
