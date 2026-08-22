export type MarketCapabilityId =
  | "realtime-quotes"
  | "intraday-1m"
  | "candlesticks-1m"
  | "security-metadata"
  | "valuation-and-activity"
  | "market-temperature"
  | "trading-calendar"
  | "capital-flow"
  | "order-book"
  | "trades"
  | "broker-queue";

export type MarketCapabilityDefinition = {
  id: MarketCapabilityId;
  label: string;
  lifecycle: "stream" | "bootstrap" | "cached" | "on-demand";
  serveMethods: string[];
  subscriptionField?: "quote" | "depth" | "trades" | "brokers";
  nativeSdkMethod?: string;
  enabledByDefault: boolean;
  cacheTtlMs?: number;
};

export type LongbridgeInitializeResult = {
  protocolVersion?: string;
  serverInfo?: { name?: string; version?: string };
  capabilities?: { subscribe?: string[] };
  methods?: string[];
};

/**
 * Read-only market capabilities that the trusted Runner may activate. Keeping
 * the allowlist here prevents future presentation features from reaching any
 * account, order, watchlist mutation, or generic passthrough API.
 */
export const MARKET_CAPABILITIES: readonly MarketCapabilityDefinition[] = [
  {
    id: "realtime-quotes",
    label: "Real-time quote ticks",
    lifecycle: "stream",
    serveMethods: ["quote.subscribe", "quote.quote"],
    subscriptionField: "quote",
    nativeSdkMethod: "subscribe",
    enabledByDefault: true,
  },
  {
    id: "intraday-1m",
    label: "One-day minute history",
    lifecycle: "bootstrap",
    serveMethods: ["quote.intraday"],
    nativeSdkMethod: "intraday",
    enabledByDefault: true,
  },
  {
    id: "candlesticks-1m",
    label: "One-minute OHLC candlesticks",
    lifecycle: "on-demand",
    serveMethods: ["quote.candlesticks"],
    nativeSdkMethod: "subscribeCandlesticks",
    enabledByDefault: false,
  },
  {
    id: "security-metadata",
    label: "Security metadata",
    lifecycle: "cached",
    serveMethods: ["quote.static_info"],
    nativeSdkMethod: "staticInfo",
    enabledByDefault: false,
    cacheTtlMs: 24 * 60 * 60_000,
  },
  {
    id: "valuation-and-activity",
    label: "Valuation and activity indexes",
    lifecycle: "cached",
    serveMethods: ["quote.calc_indexes"],
    nativeSdkMethod: "calcIndexes",
    enabledByDefault: false,
    cacheTtlMs: 5 * 60_000,
  },
  {
    id: "market-temperature",
    label: "Market temperature",
    lifecycle: "cached",
    serveMethods: ["quote.market_temperature"],
    nativeSdkMethod: "marketTemperature",
    enabledByDefault: false,
    cacheTtlMs: 5 * 60_000,
  },
  {
    id: "trading-calendar",
    label: "Trading sessions and days",
    lifecycle: "cached",
    serveMethods: ["quote.trading_session", "quote.trading_days"],
    nativeSdkMethod: "tradingSession / tradingDays",
    enabledByDefault: false,
    cacheTtlMs: 24 * 60 * 60_000,
  },
  {
    id: "capital-flow",
    label: "Capital flow and distribution",
    lifecycle: "on-demand",
    serveMethods: ["quote.capital_flow", "quote.capital_distribution"],
    nativeSdkMethod: "capitalFlow / capitalDistribution",
    enabledByDefault: false,
    cacheTtlMs: 60_000,
  },
  {
    id: "order-book",
    label: "Level 2 order book",
    lifecycle: "stream",
    serveMethods: ["quote.depth", "quote.subscribe"],
    subscriptionField: "depth",
    nativeSdkMethod: "subscribe / setOnDepth",
    enabledByDefault: false,
  },
  {
    id: "trades",
    label: "Trade prints",
    lifecycle: "stream",
    serveMethods: ["quote.trades", "quote.subscribe"],
    subscriptionField: "trades",
    nativeSdkMethod: "subscribe / setOnTrades",
    enabledByDefault: false,
  },
  {
    id: "broker-queue",
    label: "Broker queue",
    lifecycle: "stream",
    serveMethods: ["quote.brokers", "quote.subscribe"],
    subscriptionField: "brokers",
    nativeSdkMethod: "subscribe / setOnBrokers",
    enabledByDefault: false,
  },
] as const;

const allowedReadMethods = new Set(MARKET_CAPABILITIES.flatMap((capability) => capability.serveMethods));

export function assertReadOnlyMarketMethod(method: string) {
  if (!allowedReadMethods.has(method)) throw new Error(`Market method is not allowlisted: ${method}`);
  return method;
}

export function inspectMarketCapabilities(initialized: LongbridgeInitializeResult) {
  const methods = new Set(initialized.methods ?? []);
  const subscriptions = new Set(initialized.capabilities?.subscribe ?? []);
  const ready = MARKET_CAPABILITIES.filter((capability) =>
    capability.serveMethods.every((method) => methods.has(method))
      && (!capability.subscriptionField || subscriptions.has(capability.subscriptionField)),
  );
  const missing = MARKET_CAPABILITIES.filter((capability) => !ready.includes(capability));
  return {
    serverVersion: initialized.serverInfo?.version ?? "unknown",
    ready,
    missing,
  };
}

export function enabledMarketCapabilities() {
  return MARKET_CAPABILITIES.filter((capability) => capability.enabledByDefault);
}
