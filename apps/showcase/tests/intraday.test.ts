import assert from "node:assert/strict";
import test from "node:test";
import {
  appendIntradaySample,
  intradayBounds,
  intradayLadder,
  sessionProgress,
  SESSION_LENGTH_MIN,
  SESSION_TIMES,
} from "../src/intraday";

test("session progress clamps outside the HKEX cash session", () => {
  assert.equal(sessionProgress(SESSION_TIMES.start), 0);
  assert.equal(sessionProgress(SESSION_TIMES.end), 1);
  assert.equal(sessionProgress(SESSION_TIMES.start - 45), 0);
  assert.equal(sessionProgress(SESSION_TIMES.end + 45), 1);
  const midpoint = sessionProgress(SESSION_TIMES.start + SESSION_LENGTH_MIN / 2);
  assert.ok(Math.abs(midpoint - 0.5) < 1e-9);
});

test("appends intraday samples, keeps the tail bounded and drops immediate duplicates", () => {
  const first = appendIntradaySample([], { t: 1, v: 100 }, 4);
  assert.deepEqual(first, [{ t: 1, v: 100 }]);

  const withNewValue = appendIntradaySample(first, { t: 2, v: 101 }, 4);
  assert.deepEqual(withNewValue, [{ t: 1, v: 100 }, { t: 2, v: 101 }]);

  // Same value within 250ms is treated as a repeat and skipped.
  const skipped = appendIntradaySample(withNewValue, { t: 2 + 100, v: 101 }, 4);
  assert.equal(skipped, withNewValue);

  // Same value after a longer gap is still recorded so time progresses.
  const later = appendIntradaySample(withNewValue, { t: 2 + 500, v: 101 }, 4);
  assert.equal(later.length, 3);

  // Bound respects the limit.
  const bounded = appendIntradaySample(later, { t: 999, v: 102 }, 3);
  assert.equal(bounded.length, 3);
  assert.equal(bounded[bounded.length - 1].v, 102);
});

test("intraday bounds pad the domain and honour reference levels", () => {
  const bounds = intradayBounds([100, 110, 120], [], 0.1);
  assert.ok(bounds.low < 100 && bounds.high > 120);
  assert.equal(bounds.span, bounds.high - bounds.low);

  const withPrev = intradayBounds([100, 110], [150, null], 0);
  assert.equal(withPrev.high, 150);
  assert.equal(withPrev.low, 100);

  const empty = intradayBounds([], []);
  assert.deepEqual(empty, { low: 0, high: 0, span: 1 });

  const flat = intradayBounds([50, 50], [], 0.1);
  assert.ok(flat.low < 50 && flat.high > 50 && flat.span > 0);
});

test("intraday ladder spreads axis levels evenly from high to low", () => {
  assert.deepEqual(intradayLadder({ low: 0, high: 100, span: 100 }, 5), [100, 75, 50, 25, 0]);
  assert.deepEqual(intradayLadder({ low: 0, high: 10, span: 10 }, 1), [10, 0]);
});
