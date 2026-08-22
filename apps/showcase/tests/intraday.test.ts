import assert from "node:assert/strict";
import test from "node:test";
import { appendPoint, intradayBounds, intradayStats, priceLevels, projectPoints, timeAxis, toAreaPath, toLinePath } from "../src/intraday";

test("keeps the observed one-day tick tail bounded without mutating history", () => {
  const history = [{ value: 1, at: 10 }, { value: 2, at: 20 }];
  assert.deepEqual(appendPoint(history, { value: 3, at: 30 }, 5), [{ value: 1, at: 10 }, { value: 2, at: 20 }, { value: 3, at: 30 }]);
  assert.deepEqual(appendPoint(history, { value: 3, at: 30 }, 2), [{ value: 2, at: 20 }, { value: 3, at: 30 }]);
  assert.deepEqual(history, [{ value: 1, at: 10 }, { value: 2, at: 20 }]);
});

test("bounds cover the trace plus the previous close and stay non-zero", () => {
  const bounds = intradayBounds([{ value: 100, at: 1 }, { value: 200, at: 2 }], [], 0.1);
  assert.deepEqual(bounds, { low: 90, high: 210, span: 120 });
  const withPrev = intradayBounds([{ value: 100, at: 1 }], [80], 0);
  assert.deepEqual(withPrev, { low: 80, high: 100, span: 20 });
  const flat = intradayBounds([{ value: 50, at: 1 }], [], 0.1);
  assert.ok(flat.low < 50 && flat.high > 50 && flat.span > 0);
  assert.deepEqual(intradayBounds([]), { low: 0, high: 1, span: 1 });
});

test("session stats read open, last, high, low and the move against prev close", () => {
  const stats = intradayStats([{ value: 100, at: 1 }, { value: 106, at: 2 }, { value: 98, at: 3 }], 100);
  assert.deepEqual(stats, { open: 100, last: 98, high: 106, low: 98, amplitude: 8, changePercent: -2 });
  assert.equal(intradayStats([], 100), null);
  const noReference = intradayStats([{ value: 50, at: 1 }, { value: 55, at: 2 }], null);
  assert.equal(noReference?.changePercent, 10);
});

test("projects the session across the full plot width", () => {
  const points = [{ value: 0, at: 1 }, { value: 10, at: 2 }, { value: 5, at: 3 }];
  const coords = projectPoints(points, { low: 0, high: 10, span: 10 }, 100, 100, 10, 10);
  assert.deepEqual(coords, [{ x: 10, y: 90 }, { x: 50, y: 10 }, { x: 90, y: 50 }]);
  const single = projectPoints([{ value: 5, at: 1 }], { low: 0, high: 10, span: 10 }, 100, 100, 10, 10);
  assert.deepEqual(single, [{ x: 90, y: 50 }]);
});

test("serialises the trace and closes the filled area on the baseline", () => {
  const coords = [{ x: 0, y: 5 }, { x: 10, y: 1 }];
  assert.equal(toLinePath(coords), "0.00,5.00 10.00,1.00");
  assert.equal(toAreaPath(coords, 8), "0.00,8.00 0.00,5.00 10.00,1.00 10.00,8.00");
  assert.equal(toAreaPath([], 8), "");
});

test("price and time axes spread evenly over observed data", () => {
  assert.deepEqual(priceLevels({ low: 0, high: 100, span: 100 }, 5), [100, 75, 50, 25, 0]);
  const marks = timeAxis([{ value: 1, at: 100 }, { value: 2, at: 200 }, { value: 3, at: 300 }], 3);
  assert.deepEqual(marks, [{ at: 100, ratio: 0 }, { at: 200, ratio: 0.5 }, { at: 300, ratio: 1 }]);
  assert.deepEqual(timeAxis([]), []);
  assert.equal(timeAxis([{ value: 1, at: 42 }]).length, 1);
});
