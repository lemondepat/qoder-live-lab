import assert from "node:assert/strict";
import test from "node:test";
import { anchorSeries, appendPoint, areaPath, clampToSession, formatMinute, hongKongMinute, hongKongTradingDay, intradayExtremes, intradaySpan, linePath, observationScope, percentFrom, priceLevels, runningAverage, SESSION, sessionProgress, timeLevels, tradedMinutes, TRADED_MINUTES } from "../src/intraday";

test("compresses the lunch break out of the traded timeline", () => {
  assert.equal(TRADED_MINUTES, 330);
  assert.equal(tradedMinutes(SESSION.open), 0);
  assert.equal(tradedMinutes(8 * 60), 0);
  assert.equal(tradedMinutes(SESSION.lunchStart), 150);
  assert.equal(tradedMinutes(12 * 60 + 30), 150);
  assert.equal(tradedMinutes(SESSION.lunchEnd), 150);
  assert.equal(tradedMinutes(14 * 60), 210);
  assert.equal(tradedMinutes(SESSION.close), 330);
  assert.equal(tradedMinutes(23 * 60), 330);
});

test("maps session progress into a 0 to 1 range", () => {
  assert.equal(sessionProgress(SESSION.open), 0);
  assert.equal(sessionProgress(SESSION.close), 1);
  assert.ok(sessionProgress(14 * 60) > sessionProgress(SESSION.lunchEnd));
});

test("reads Hong Kong wall-clock minutes from an instant", () => {
  assert.equal(hongKongMinute(new Date("2026-08-21T01:30:00Z")), 9 * 60 + 30);
  assert.equal(formatMinute(9 * 60 + 30), "09:30");
  assert.equal(formatMinute(SESSION.close), "16:00");
});

test("clamps wall-clock minutes into the Hong Kong cash session", () => {
  assert.equal(clampToSession(8 * 60), SESSION.open);
  assert.equal(clampToSession(SESSION.open), SESSION.open);
  assert.equal(clampToSession(14 * 60), 14 * 60);
  assert.equal(clampToSession(SESSION.close), SESSION.close);
  assert.equal(clampToSession(23 * 60), SESSION.close);
  assert.equal(clampToSession(Number.NaN), SESSION.open);
});

test("reads the Hong Kong trading day and isolates observation scopes", () => {
  assert.equal(hongKongTradingDay(new Date("2026-08-21T01:30:00Z")), "2026-08-21");
  assert.equal(hongKongTradingDay(new Date("2026-08-21T17:00:00Z")), "2026-08-22");
  const live = observationScope("longbridge", "2026-08-21", "HSI");
  assert.equal(live, "longbridge|2026-08-21|HSI");
  assert.notEqual(live, observationScope("demo", "2026-08-21", "HSI"));
  assert.notEqual(live, observationScope("longbridge", "2026-08-22", "HSI"));
  assert.notEqual(live, observationScope("longbridge", "2026-08-21", "HSTECH"));
});

test("keeps one intraday point per minute and bounds the tail", () => {
  const first = appendPoint([], { minute: 570, value: 100 }, 3);
  const same = appendPoint(first, { minute: 570, value: 101 }, 3);
  assert.deepEqual(same, [{ minute: 570, value: 101 }]);
  const next = appendPoint(same, { minute: 571, value: 102 }, 2);
  assert.deepEqual(next, [{ minute: 570, value: 101 }, { minute: 571, value: 102 }]);
  assert.deepEqual(appendPoint(next, { minute: 572, value: 103 }, 2), [{ minute: 571, value: 102 }, { minute: 572, value: 103 }]);
});

test("pads the vertical domain around observed points and reference levels", () => {
  const span = intradaySpan([{ minute: 570, value: 100 }, { minute: 571, value: 110 }], [null], 0.1);
  assert.equal(span.low, 99);
  assert.equal(span.high, 111);
  assert.equal(span.span, 12);
  const withPrev = intradaySpan([{ minute: 570, value: 100 }], [120], 0);
  assert.deepEqual(withPrev, { low: 100, high: 120, span: 20 });
  const flat = intradaySpan([{ minute: 570, value: 50 }], [], 0.1);
  assert.ok(flat.low < 50 && flat.high > 50 && flat.span > 0);
  assert.deepEqual(intradaySpan([], []), { low: 0, high: 1, span: 1 });
});

test("tracks the session high and low with their minutes", () => {
  const points = [{ minute: 570, value: 100 }, { minute: 600, value: 106 }, { minute: 660, value: 98 }];
  assert.deepEqual(intradayExtremes(points), { high: 106, highMinute: 600, low: 98, lowMinute: 660 });
  assert.equal(intradayExtremes([]), null);
});

test("averages observed prices cumulatively", () => {
  const average = runningAverage([{ minute: 1, value: 10 }, { minute: 2, value: 20 }, { minute: 3, value: 30 }]);
  assert.deepEqual(average.map((point) => point.value), [10, 15, 20]);
});

test("derives percent offsets against the previous close", () => {
  assert.equal(percentFrom(100, 110), 10);
  assert.equal(percentFrom(100, 95), -5);
  assert.equal(percentFrom(null, 110), null);
  assert.equal(percentFrom(0, 110), null);
});

test("spreads price levels and marks the session gridline minutes", () => {
  assert.deepEqual(priceLevels({ low: 0, high: 100, span: 100 }, 5), [100, 75, 50, 25, 0]);
  const times = timeLevels();
  assert.equal(times[0], SESSION.open);
  assert.equal(times[times.length - 1], SESSION.close);
  assert.ok(times.includes(SESSION.lunchStart) && times.includes(SESSION.lunchEnd));
});

test("builds line and closed area paths, including a single-point session", () => {  const points = [{ minute: 0, value: 0 }, { minute: 10, value: 10 }];
  const x = (minute: number) => minute;
  const y = (value: number) => value;
  assert.equal(linePath(points, x, y), "M0.00,0.00L10.00,10.00");
  assert.equal(linePath([points[0]], x, y), "M0.00,0.00L0.00,0.00");
  assert.equal(linePath([], x, y), "");
  assert.equal(areaPath(points, x, y, 50), "M0.00,0.00L10.00,10.00L10.00,50.00L0.00,50.00Z");
  assert.equal(areaPath([], x, y, 50), "");
});

test("anchors the drawn line at the previous close so a single tick still renders a visible line", () => {
  const first = anchorSeries(100, [{ minute: 600, value: 106 }]);
  assert.deepEqual(first, [{ minute: SESSION.open, value: 100 }, { minute: 600, value: 106 }]);
  const x = (minute: number) => minute;
  const y = (value: number) => value;
  assert.equal(linePath(first, x, y), `M${SESSION.open}.00,100.00L600.00,106.00`);
  assert.notEqual(linePath(anchorSeries(100, [{ minute: 600, value: 106 }]), x, y), linePath([{ minute: 600, value: 106 }], x, y));
  assert.deepEqual(anchorSeries(100, [{ minute: SESSION.open, value: 101 }]), [{ minute: SESSION.open, value: 101 }]);
  assert.deepEqual(anchorSeries(null, [{ minute: 600, value: 106 }]), [{ minute: 600, value: 106 }]);
  assert.deepEqual(anchorSeries(100, []), [{ minute: SESSION.open, value: 100 }]);
});
