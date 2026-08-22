import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MarketQuote } from "../src/market-data";
import { boardTotals, buildSectorBoard, normalizedTrail, quoteWeight, tileSpan } from "../src/sector-leadership";

function quote(partial: Partial<MarketQuote> & { symbol: string; sector: string; change: number }): MarketQuote {
  return {
    name: partial.symbol,
    price: 100,
    previousClose: 100,
    volume: "1.0M",
    trail: [10, 12, 11],
    intraday: [],
    ...partial,
  } as MarketQuote;
}

const quotes: MarketQuote[] = [
  quote({ symbol: "A", sector: "Internet", change: 3, intraday: [{ timestamp: "t", price: 10, volume: 1, turnover: 900 }] }),
  quote({ symbol: "B", sector: "Internet", change: -1, intraday: [{ timestamp: "t", price: 10, volume: 1, turnover: 100 }] }),
  quote({ symbol: "C", sector: "Mobility", change: -2.5, intraday: [{ timestamp: "t", price: 10, volume: 1, turnover: 400 }] }),
];

test("groups quotes into sector blocks ordered by trusted turnover weight", () => {
  const board = buildSectorBoard(quotes);
  assert.deepEqual(board.map((block) => block.sector), ["Internet", "Mobility"]);
  assert.equal(board[0].weight, 1000);
  assert.equal(board[0].advancers, 1);
  assert.equal(board[0].decliners, 1);
  assert.equal(board[0].averageChange, 1);
  assert.equal(board[0].leader.symbol, "A");
  assert.ok(board[0].share > board[1].share);
  assert.deepEqual(board[0].cells.map((cell) => cell.quote.symbol), ["A", "B"]);
});

test("falls back to the live move when intraday turnover has not arrived", () => {
  const pending = quote({ symbol: "D", sector: "Media", change: -2 });
  assert.equal(quoteWeight(pending), 2.25);
  const board = buildSectorBoard([pending]);
  assert.equal(board[0].turnoverBacked, false);
  assert.equal(board[0].share, 1);
});

test("tile span stays inside the twelve column board", () => {
  assert.equal(tileSpan(0), 3);
  assert.equal(tileSpan(0.5), 7);
  assert.equal(tileSpan(1), 12);
});

test("board totals summarize breadth, dispersion, and leadership", () => {
  const totals = boardTotals(buildSectorBoard(quotes));
  assert.equal(totals.sectors, 2);
  assert.equal(totals.names, 3);
  assert.equal(totals.advancers, 1);
  assert.equal(totals.decliners, 2);
  assert.equal(totals.dispersion, 5.5);
  assert.equal(totals.strongest?.sector, "Internet");
  assert.equal(totals.weakest?.sector, "Mobility");
  assert.equal(boardTotals([]).names, 0);
});

test("normalized trail maps the trusted tail onto 0..100 without inventing points", () => {
  assert.deepEqual(normalizedTrail([]), []);
  assert.deepEqual(normalizedTrail([5, 10, 7.5]), [0, 100, 50]);
  assert.deepEqual(normalizedTrail([4, 4]), [0, 0]);
});

test("the showcase renders the sector heatmap board instead of the plain table", () => {
  const showcase = readFileSync(fileURLToPath(new URL("../src/Showcase.tsx", import.meta.url)), "utf8");
  assert.match(showcase, /<SectorHeatmapBoard\b/);
  assert.doesNotMatch(showcase, /plain-table/);
  assert.match(showcase, /useMarketFeed\(\)/);
  assert.match(showcase, /DISPLAY ONLY · NOT INVESTMENT ADVICE/);
});
