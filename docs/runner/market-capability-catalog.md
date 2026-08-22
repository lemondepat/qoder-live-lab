# Trusted market capability catalog

This is the operator-facing catalog for the market-data sidecar on computer B. Audience requirements and Qoder Cloud Agent candidates cannot call these APIs directly. The trusted Runner is the only process allowed to normalize, cache, and publish a new market field.

## Active shared path

The production path has one Longbridge connection and one in-memory cache:

1. Start `longbridge serve` and call `initialize` to verify the read-only method surface.
2. Subscribe once to `quote` for the three indices and six equities.
3. Call `quote.intraday` once per instrument to backfill today's minute history.
4. Fold every `quote.updated` push into the current minute. Cumulative volume and turnover make replayed ticks idempotent.
5. Publish the sanitized cache every 20 seconds. Browsers read `/api/market`; they do not connect to Longbridge.
6. If the process disconnects, retain the last good cache, reconnect, resubscribe, and call `quote.intraday` once per instrument to fill the gap.

The installed `longbridge serve` protocol exposes live notifications for quotes, depth, broker queues, and trades. It exposes `quote.candlesticks` as a pull method, but it does not expose the SDK's native candlestick push callback. The current transport therefore builds the live current minute from official quote pushes. If computer B later moves to the official SDK transport, use `subscribeCandlesticks(symbol, Period.Min_1, TradeSessions.Intraday)` and keep the same bootstrap, reconnect, cache, and sanitization contract.

## Prepared read-only capabilities

| Capability | Longbridge surface | Lifecycle | Default |
|---|---|---|---|
| Real-time quotes | `quote.subscribe` + `quote.quote` | One shared stream | Active |
| One-day minute line | `quote.intraday` | Startup/reconnect backfill | Active |
| One-minute OHLC | `quote.candlesticks`; SDK `subscribeCandlesticks` | On demand / future native stream | Prepared |
| Security metadata | `quote.static_info` | Cache for 24 hours | Prepared |
| Valuation and activity | `quote.calc_indexes` | Cache for 5 minutes | Prepared |
| Market temperature | `quote.market_temperature` | Cache for 5 minutes | Prepared |
| Trading calendar | `quote.trading_session` + `quote.trading_days` | Cache for 24 hours | Prepared |
| Capital flow | `quote.capital_flow` + `quote.capital_distribution` | Cache for 60 seconds | Prepared |
| Order book | `quote.depth` + `depth` subscription | Opt-in shared stream; requires permission | Prepared |
| Trade prints | `quote.trades` + `trades` subscription | Opt-in shared stream | Prepared |
| Broker queue | `quote.brokers` + `brokers` subscription | Opt-in shared stream; requires permission | Prepared |

The code allowlist intentionally excludes `trade.*`, generic `api.get`/`api.post`, watchlist mutation, order submission, positions, balances, and account data.

## Activating a prepared capability

Activation is a trusted control-plane change, not a canvas change:

1. Confirm quote permissions and the provider response with a read-only smoke test.
2. Add a minimal typed public field to `packages/contracts` and its Zod validator.
3. Normalize and bound the payload in the Runner; set the cache TTL or subscription lifecycle from this catalog.
4. Publish only display-safe market facts. Never publish account identifiers, credentials, or unrestricted provider payloads.
5. Update `docs/qca/market-data-capabilities.md` so Qoder knows exactly which fields exist.
6. Add normalization, replay, reconnect, timeout, and public-schema tests before enabling it on computer B.

Do not activate depth, trades, or broker queues for all symbols by default. They are higher-volume streams and may require additional quote permissions; subscribe only for the focused symbol a verified presentation feature needs.
