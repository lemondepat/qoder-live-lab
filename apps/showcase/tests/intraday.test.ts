import assert from "node:assert/strict";
import test from "node:test";
import { areaPath, buildIntradaySeries, intradayDomain, intradayStats, polylinePoints, scalePoints, seriesBounds, sparkPoints } from "../src/intraday";

test("seeds the one-day track with the previous close and derives each move", () => {
  const series = buildIntradaySeries(100, [101, 99]);
  assert.deepEqual(series.map((point) => point.value), [100, 101, 99]);
  assert.deepEqual(series.map((point) => point.index), [0, 1, 2]);
  assert.ok(Math.abs(series[1].changePercent - 1) < 1e-9);
  assert.ok(Math.abs(series[2].changePercent + 1) < 1e-9);
});

test("falls back to the first observed tick when no previous close exists", () => {
  const series = buildIntradaySeries(null, [50, 55]);
  assert.deepEqual(series.map((point) => point.value), [50, 55]);
  assert.equal(series[0].changePercent, 0);
  assert.ok(Math.abs(series[1].changePercent - 10) < 1e-9);
  assert.deepEqual(buildIntradaySeries(null, []), []);
});

test("summarises the session high, low, range and move", () => {
  const stats = intradayStats(buildIntradaySeries(100, [104, 98, 102]));
  assert.deepEqual(stats, { open: 100, last: 102, high: 104, low: 98, changePercent: 2, range: 6 });
  assert.equal(intradayStats([]), null);
});

test("keeps a non-zero span for a flat track and pads the drawing domain", () => {
  assert.deepEqual(seriesBounds([20, 20]), { low: 20, high: 20, span: 1 });
  assert.deepEqual(seriesBounds([]), { low: 0, high: 0, span: 1 });
  const domain = intradayDomain([100, 110], [95]);
  assert.ok(domain.low < 95 && domain.high > 110 && domain.span > 0);
});

test("spreads the line across the plot and centres a lone tick", () => {
  const bounds = { low: 0, high: 10, span: 10 };
  const points = scalePoints([0, 5, 10], bounds, 100, 100);
  assert.deepEqual(points, [{ x: 0, y: 100 }, { x: 50, y: 50 }, { x: 100, y: 0 }]);
  assert.deepEqual(scalePoints([5], bounds, 100, 100), [{ x: 50, y: 50 }]);
  assert.equal(polylinePoints(points), "0.00,100.00 50.00,50.00 100.00,0.00");
});

test("closes the shaded session area on the chart baseline", () => {
  const path = areaPath([{ x: 0, y: 10 }, { x: 100, y: 20 }], 50);
  assert.equal(path, "M0.00 50.00 L0.00 10.00 L100.00 20.00 L100.00 50.00 Z");
  assert.equal(areaPath([], 50), "");
});

test("self-scales the comparison sparkline and stays empty without ticks", () => {
  assert.match(sparkPoints([1, 2, 3], 100, 34), /^0\.00,32\.00 50\.00,/);
  assert.equal(sparkPoints([], 100, 34), "");
});
