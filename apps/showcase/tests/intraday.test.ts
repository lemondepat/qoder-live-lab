import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LUNCH_END, LUNCH_START, SESSION_CLOSE, SESSION_OPEN, appendPoint, minuteLabel, percentFrom, seriesStats, sessionOffset, timeTicks } from "../src/intraday";

const showcase = readFileSync(fileURLToPath(new URL("../src/Showcase.tsx", import.meta.url)), "utf8");

test("the candlestick K-line is replaced by a one-day intraday live chart", () => {
  assert.doesNotMatch(showcase, /kline|CandleChart|buildCandles/i);
  assert.match(showcase, /className="intraday-panel"/);
  assert.match(showcase, /1-DAY INTRADAY · LIVE TICKS/);
});

test("intraday points stay one per minute and bounded", () => {
  const first = appendPoint([], { minute: 570, value: 100 }, 3);
  const sameMinute = appendPoint(first, { minute: 570, value: 101 }, 3);
  assert.deepEqual(sameMinute, [{ minute: 570, value: 101 }]);
  const grown = appendPoint(appendPoint(appendPoint(sameMinute, { minute: 571, value: 102 }, 3), { minute: 572, value: 103 }, 3), { minute: 573, value: 104 }, 3);
  assert.equal(grown.length, 3);
  assert.deepEqual(grown[0], { minute: 571, value: 102 });
  assert.deepEqual(first, [{ minute: 570, value: 100 }]);
});

test("summarises the observed intraday session", () => {
  assert.equal(seriesStats([]), null);
  assert.deepEqual(seriesStats([{ minute: 570, value: 10 }, { minute: 571, value: 30 }, { minute: 572, value: 20 }]), {
    open: 10,
    last: 20,
    high: 30,
    low: 10,
    average: 20,
  });
});

test("clamps session offsets to the trading window", () => {
  assert.equal(sessionOffset(SESSION_OPEN), 0);
  assert.equal(sessionOffset(SESSION_CLOSE), 1);
  assert.equal(sessionOffset(SESSION_OPEN - 60), 0);
  assert.equal(sessionOffset(SESSION_CLOSE + 60), 1);
  assert.ok(sessionOffset(LUNCH_START) < sessionOffset(LUNCH_END));
});

test("formats clock labels and guards percent maths", () => {
  assert.equal(minuteLabel(SESSION_OPEN), "09:30");
  assert.equal(minuteLabel(SESSION_CLOSE), "16:00");
  assert.equal(percentFrom(100, 110), 10);
  assert.equal(percentFrom(0, 110), null);
  assert.equal(percentFrom(null, 110), null);
});

test("spreads intraday time ticks across the whole session", () => {
  const ticks = timeTicks(6);
  assert.equal(ticks.length, 6);
  assert.equal(ticks[0].label, "09:30");
  assert.equal(ticks[5].label, "16:00");
});
