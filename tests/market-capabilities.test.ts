import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKET_CAPABILITIES,
  assertReadOnlyMarketMethod,
  enabledMarketCapabilities,
  inspectMarketCapabilities,
} from "../apps/runner/src/market-capabilities";

test("keeps the market capability catalog read-only and account independent", () => {
  const methods = MARKET_CAPABILITIES.flatMap((capability) => capability.serveMethods);
  assert.ok(methods.every((method) => method.startsWith("quote.")));
  assert.ok(methods.every((method) => !/(create|update|delete|watchlist)/.test(method)));
  assert.throws(() => assertReadOnlyMarketMethod("trade.submit_order"), /not allowlisted/);
  assert.throws(() => assertReadOnlyMarketMethod("api.get"), /not allowlisted/);
});

test("discovers baseline and prepared capabilities from the running CLI surface", () => {
  const methods = [...new Set(MARKET_CAPABILITIES.flatMap((capability) => capability.serveMethods))];
  const report = inspectMarketCapabilities({
    serverInfo: { version: "0.28.2" },
    capabilities: { subscribe: ["quote", "depth", "brokers", "trades"] },
    methods,
  });
  assert.equal(report.serverVersion, "0.28.2");
  assert.equal(report.ready.length, MARKET_CAPABILITIES.length);
  assert.deepEqual(enabledMarketCapabilities().map((capability) => capability.id), ["realtime-quotes", "intraday-1m"]);
});

test("does not report a streaming capability when its subscription field is unavailable", () => {
  const methods = [...new Set(MARKET_CAPABILITIES.flatMap((capability) => capability.serveMethods))];
  const report = inspectMarketCapabilities({ capabilities: { subscribe: ["quote"] }, methods });
  assert.ok(report.ready.some((capability) => capability.id === "realtime-quotes"));
  assert.ok(report.missing.some((capability) => capability.id === "order-book"));
  assert.ok(report.missing.some((capability) => capability.id === "trades"));
});
