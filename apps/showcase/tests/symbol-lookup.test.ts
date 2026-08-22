import assert from "node:assert/strict";
import test from "node:test";
import type { MarketIndex, MarketQuote } from "../src/market-data";
import { indexInstrument, stockInstrument } from "../src/intraday-scope";
import { lookupInstrument, normalizeCode, rememberCode, searchInstruments } from "../src/symbol-lookup";

const index: MarketIndex = { symbol: "HSTECH", label: "Hang Seng TECH", value: "5,678.31", last: 5678.31, previousClose: 5598.81, change: 1.42, intraday: [] };
const tencent: MarketQuote = { symbol: "0700", name: "Tencent", sector: "Internet", price: 586.5, previousClose: 580, change: 1.12, volume: "16.8M", trail: [], intraday: [] };
const xiaomi: MarketQuote = { symbol: "1810", name: "Xiaomi", sector: "Hardware", price: 55.2, previousClose: 53.57, change: 3.04, volume: "102M", trail: [], intraday: [] };
const universe = [indexInstrument(index), stockInstrument(tencent), stockInstrument(xiaomi)];

test("normalizes typed Hong Kong codes to the feed convention", () => {
  assert.equal(normalizeCode(" 700 "), "0700");
  assert.equal(normalizeCode("0700.HK"), "0700");
  assert.equal(normalizeCode("hk:1810"), "1810");
  assert.equal(normalizeCode("xiaomi"), "XIAOMI");
  assert.equal(normalizeCode("   "), "");
});

test("searches trusted instruments by code, name and sector", () => {
  assert.deepEqual(searchInstruments(universe, "700").map((entry) => entry.symbol), ["0700"]);
  assert.deepEqual(searchInstruments(universe, "18").map((entry) => entry.symbol), ["1810"]);
  assert.deepEqual(searchInstruments(universe, "hang").map((entry) => entry.symbol), ["HSTECH"]);
  assert.deepEqual(searchInstruments(universe, "internet").map((entry) => entry.symbol), ["0700"]);
  assert.deepEqual(searchInstruments(universe, ""), []);
  assert.equal(searchInstruments(universe, "1", 1).length, 1);
});

test("resolves a submitted code to one trusted instrument across scopes", () => {
  const stock = lookupInstrument(universe, "1810.HK");
  assert.equal(stock.state, "resolved");
  assert.equal(stock.state === "resolved" && stock.instrument.symbol, "1810");
  assert.equal(stock.state === "resolved" && stock.instrument.kind, "stock");
  const idx = lookupInstrument(universe, "hstech");
  assert.equal(idx.state === "resolved" && idx.instrument.kind, "index");
  assert.equal(lookupInstrument(universe, " ").state, "idle");
});

test("keeps unknown codes honest instead of charting invented data", () => {
  const miss = lookupInstrument(universe, "9999");
  assert.equal(miss.state, "unknown");
  assert.equal(miss.state === "unknown" && miss.code, "9999");
  assert.ok(miss.state === "unknown" && miss.suggestions.length > 0);
  assert.ok(miss.state === "unknown" && miss.suggestions.every((entry) => universe.includes(entry)));
});

test("remembers recent codes without duplicates, newest first", () => {
  assert.deepEqual(rememberCode(["0700"], "1810"), ["1810", "0700"]);
  assert.deepEqual(rememberCode(["1810", "0700"], "0700"), ["0700", "1810"]);
  assert.deepEqual(rememberCode(["a", "b", "c"], "d", 2), ["d", "a"]);
});
