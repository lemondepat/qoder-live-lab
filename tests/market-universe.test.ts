import assert from "node:assert/strict";
import test from "node:test";
import {
  FEATURED_VENDOR_SYMBOLS,
  MARKET_EQUITY_COUNT,
  MARKET_INSTRUMENTS,
  resolveMarketVendorSymbol,
} from "../apps/runner/src/market-universe";
import { buildActiveIntradaySnapshots, buildSnapshot, mergeIntraday, mergeQuote } from "../apps/runner/src/market-feed";
import type { MarketQuoteSnapshot } from "@qoder-live-lab/contracts";

test("publishes a unique one-hundred-stock Hong Kong universe", () => {
  const equities = MARKET_INSTRUMENTS.filter((instrument) => instrument.kind === "equity");
  assert.equal(MARKET_EQUITY_COUNT, 100);
  assert.equal(equities.length, 100);
  assert.equal(new Set(equities.map((instrument) => instrument.symbol)).size, 100);
  assert.equal(new Set(equities.map((instrument) => instrument.vendorSymbol)).size, 100);
  assert.equal(FEATURED_VENDOR_SYMBOLS.size, 9);
  assert.ok(equities.every((instrument) => instrument.vendorSymbol.endsWith(".HK")));
});

test("resolves display and vendor codes only inside the bounded universe", () => {
  assert.equal(resolveMarketVendorSymbol("700"), "700.HK");
  assert.equal(resolveMarketVendorSymbol("0700"), "700.HK");
  assert.equal(resolveMarketVendorSymbol("700.HK"), "700.HK");
  assert.equal(resolveMarketVendorSymbol("HSI"), "HSI.HK");
  assert.equal(resolveMarketVendorSymbol("999999"), undefined);
});

test("keeps a one-hundred-stock quote snapshot small by splitting minute history", () => {
  const values = new Map<string, MarketQuoteSnapshot>();
  for (const [position, instrument] of MARKET_INSTRUMENTS.entries()) {
    mergeQuote(values, {
      symbol: instrument.vendorSymbol,
      last_done: String(100 + position),
      prev_close: String(99 + position),
      timestamp: "2026-08-26T05:30:00Z",
    });
  }
  mergeIntraday(values, "700.HK", [{ price: "448.6", timestamp: "2026-08-26T05:30:00Z", volume: "10", turnover: "4486" }]);
  const snapshot = buildSnapshot([...values.values()], 12, new Date("2026-08-26T05:30:02Z"));
  assert.equal(snapshot.quotes.length, 100);
  assert.equal(snapshot.indices.length, 3);
  assert.ok([...snapshot.indices, ...snapshot.quotes].every((quote) => quote.intraday.length === 0));
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 250_000);
});

test("publishes minute history again only when an active symbol changed", () => {
  const values = new Map<string, MarketQuoteSnapshot>();
  for (const vendorSymbol of ["700.HK", "5.HK"]) {
    mergeQuote(values, {
      symbol: vendorSymbol,
      last_done: "100",
      prev_close: "99",
      timestamp: "2026-08-21T05:30:00Z",
    });
    mergeIntraday(values, vendorSymbol, [{ price: "100", timestamp: "2026-08-21T05:30:00Z" }]);
  }
  const active = new Map([["700.HK", Number.POSITIVE_INFINITY], ["5.HK", Number.POSITIVE_INFINITY]]);
  const dirty = new Set(["5.HK"]);
  const snapshots = buildActiveIntradaySnapshots(values, active, 13, new Date("2026-08-21T05:30:02Z"), dirty);
  assert.deepEqual(snapshots.map((snapshot) => snapshot.vendorSymbol), ["5.HK"]);
});
