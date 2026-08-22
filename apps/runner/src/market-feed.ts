import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { MarketIntradayPoint, MarketIntradaySnapshot, MarketQuoteSnapshot, MarketSession, MarketSnapshot } from "@qoder-live-lab/contracts";
import type { RunnerConfig } from "./config";
import {
  assertReadOnlyMarketMethod,
  enabledMarketCapabilities,
  inspectMarketCapabilities,
  type LongbridgeInitializeResult,
} from "./market-capabilities";
import {
  FEATURED_VENDOR_SYMBOLS,
  MARKET_INSTRUMENT_BY_VENDOR,
  MARKET_INSTRUMENTS,
  resolveMarketVendorSymbol,
} from "./market-universe";

type RawQuote = Record<string, unknown> & { symbol?: string };
type RawIntradayPoint = Record<string, unknown> & { timestamp?: unknown; price?: unknown };
type RpcMessage = {
  id?: number;
  method?: string;
  result?: unknown;
  params?: RawQuote;
  error?: { code?: number; message?: string };
};
type MarketCache = {
  quotes: Map<string, MarketQuoteSnapshot>;
  sequence: number;
};

const INITIALIZE_ID = 1;
const SUBSCRIBE_ID = 2;
const QUOTE_SNAPSHOT_ID = 3;
const INTRADAY_REQUEST_INTERVAL_MS = 125;
const INTRADAY_MAX_IN_FLIGHT = 5;
const ON_DEMAND_ACTIVE_MS = 10 * 60_000;

export function startMarketFeed(
  config: RunnerConfig,
  publish: (snapshot: MarketSnapshot) => Promise<void>,
  publishIntraday: (snapshots: MarketIntradaySnapshot[]) => Promise<void> = async () => undefined,
  onStatus: (message: string) => void = (message) => process.stdout.write(`${message}\n`),
) {
  if (config.marketFeedProvider !== "longbridge") return { stop() {}, requestIntraday(symbols: string[]) { void symbols; } };
  let stopped = false;
  let child: ChildProcessWithoutNullStreams | undefined;
  const cache: MarketCache = { quotes: new Map(), sequence: 0 };
  const activeIntraday = new Map([...FEATURED_VENDOR_SYMBOLS].map((symbol) => [symbol, Number.POSITIVE_INFINITY]));

  void (async () => {
    let backoffMs = 2_000;
    while (!stopped) {
      try {
        child = spawn(config.longbridgeBinary, ["serve"], { stdio: "pipe" });
        onStatus(cache.quotes.size
          ? "Market feed · reconnecting; last good shared snapshot remains available"
          : "Market feed · connecting to Longbridge OpenAPI");
        await runSession(child, cache, activeIntraday, config.marketPublishMs, publish, publishIntraday, onStatus, () => stopped);
        backoffMs = 2_000;
      } catch (error) {
        if (!stopped) {
          onStatus(`Market feed unavailable · ${safeMessage(error)}`);
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, 30_000);
        }
      }
    }
  })();

  return {
    requestIntraday(symbols: string[]) {
      const expiresAt = Date.now() + ON_DEMAND_ACTIVE_MS;
      for (const symbol of symbols) {
        const vendorSymbol = resolveMarketVendorSymbol(symbol);
        if (vendorSymbol) activeIntraday.set(vendorSymbol, expiresAt);
      }
    },
    stop() {
      stopped = true;
      if (child?.stdin.writable) child.stdin.end();
      child?.kill("SIGTERM");
    },
  };
}

async function runSession(
  child: ChildProcessWithoutNullStreams,
  cache: MarketCache,
  activeIntraday: Map<string, number>,
  publishMs: number,
  publish: (snapshot: MarketSnapshot) => Promise<void>,
  publishIntraday: (snapshots: MarketIntradaySnapshot[]) => Promise<void>,
  onStatus: (message: string) => void,
  isStopped: () => boolean,
) {
  let publishTimer: NodeJS.Timeout | undefined;
  let publishing = Promise.resolve();
  let connected = false;
  let lastPublishedAt = 0;
  const cadenceMs = Number.isFinite(publishMs) ? Math.max(1_000, publishMs) : 20_000;
  const reader = createInterface({ input: child.stdout });
  const intradayRequests = new Map<number, string>();
  const intradayQueue: string[] = [];
  const requestedThisSession = new Set<string>();
  const retryAfter = new Map<string, number>();
  let intradayPump: NodeJS.Timeout | undefined;
  let quoteSnapshotInFlight = false;
  let nextRpcId = 100;

  const queuePublish = (immediate = false) => {
    if (publishTimer) return;
    const run = () => {
      publishTimer = undefined;
      if (!cache.quotes.size || isStopped()) return;
      lastPublishedAt = Date.now();
      cache.sequence += 1;
      const snapshot = buildSnapshot([...cache.quotes.values()], cache.sequence);
      const activeSnapshots = buildActiveIntradaySnapshots(cache.quotes, activeIntraday, cache.sequence);
      publishing = publishing
        .then(async () => {
          await publish(snapshot);
          if (activeSnapshots.length) await publishIntraday(activeSnapshots);
        })
        .catch((error) => onStatus(`Market snapshot delivery failed · ${safeMessage(error)}`));
    };
    const elapsed = Date.now() - lastPublishedAt;
    const delay = immediate && lastPublishedAt === 0 ? 0 : Math.max(250, cadenceMs - elapsed);
    if (delay === 0) run();
    else publishTimer = setTimeout(run, delay);
  };

  const writeRequest = (id: number, method: string, params?: Record<string, unknown>) => {
    if (method.startsWith("quote.")) assertReadOnlyMarketMethod(method);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
  };

  const scheduleIntradayPump = (delay = 0) => {
    if (intradayPump || !intradayQueue.length) return;
    intradayPump = setTimeout(() => {
      intradayPump = undefined;
      if (isStopped() || !child.stdin.writable || intradayRequests.size >= INTRADAY_MAX_IN_FLIGHT) {
        scheduleIntradayPump(INTRADAY_REQUEST_INTERVAL_MS);
        return;
      }
      const vendorSymbol = intradayQueue.shift();
      if (!vendorSymbol) return;
      const id = nextRpcId++;
      intradayRequests.set(id, vendorSymbol);
      writeRequest(id, "quote.intraday", { symbol: vendorSymbol, trade_session: "intraday" });
      scheduleIntradayPump(INTRADAY_REQUEST_INTERVAL_MS);
    }, delay);
  };

  const requestIntraday = (symbols: string[]) => {
    if (isStopped()) return;
    for (const vendorSymbol of symbols) {
      if (!MARKET_INSTRUMENT_BY_VENDOR.has(vendorSymbol) || requestedThisSession.has(vendorSymbol)) continue;
      if ((retryAfter.get(vendorSymbol) ?? 0) > Date.now()) continue;
      requestedThisSession.add(vendorSymbol);
      intradayQueue.push(vendorSymbol);
    }
    scheduleIntradayPump();
  };

  const queueActiveIntraday = () => {
    const current = Date.now();
    for (const [symbol, expiresAt] of activeIntraday) {
      if (expiresAt < current) activeIntraday.delete(symbol);
    }
    requestIntraday([...activeIntraday.keys()]);
  };

  const requestQuoteSnapshot = () => {
    if (quoteSnapshotInFlight || isStopped() || !child.stdin.writable) return;
    quoteSnapshotInFlight = true;
    writeRequest(QUOTE_SNAPSHOT_ID, "quote.quote", {
      symbols: MARKET_INSTRUMENTS.map((item) => item.vendorSymbol),
    });
  };

  const heartbeat = setInterval(() => queuePublish(), Math.max(5_000, cadenceMs));
  const demandPoll = setInterval(queueActiveIntraday, 500);
  const startup = setTimeout(() => child.kill("SIGTERM"), 15_000);

  child.stderr.on("data", (chunk) => {
    const message = String(chunk).trim();
    if (message) onStatus(`Longbridge · ${message.replace(/\s+/g, " ").slice(0, 180)}`);
  });

  writeRequest(INITIALIZE_ID, "initialize");

  return new Promise<void>((resolve, reject) => {
    reader.on("line", (line) => {
      let message: RpcMessage;
      try { message = JSON.parse(line) as RpcMessage; } catch { return; }

      if (message.error) {
        const intradaySymbol = message.id === undefined ? undefined : intradayRequests.get(message.id);
        if (intradaySymbol) {
          intradayRequests.delete(message.id!);
          requestedThisSession.delete(intradaySymbol);
          retryAfter.set(intradaySymbol, Date.now() + 5_000);
          scheduleIntradayPump(INTRADAY_REQUEST_INTERVAL_MS);
          onStatus(`Longbridge intraday unavailable for ${intradaySymbol} · ${message.error.message ?? "request failed"}`);
          return;
        }
        if (message.id === QUOTE_SNAPSHOT_ID) {
          quoteSnapshotInFlight = false;
          onStatus(`Longbridge quote snapshot unavailable · ${message.error.message ?? "live pushes will continue"}`);
          return;
        }
        reject(new Error(`Longbridge ${message.error.code ?? "error"}: ${message.error.message ?? "request failed"}`));
        child.kill("SIGTERM");
        return;
      }

      if (message.id === INITIALIZE_ID) {
        const report = inspectMarketCapabilities((message.result ?? {}) as LongbridgeInitializeResult);
        const missingBaseline = enabledMarketCapabilities().filter((capability) =>
          !report.ready.some((ready) => ready.id === capability.id));
        if (missingBaseline.length) {
          reject(new Error(`Longbridge serve is missing required read-only capabilities: ${missingBaseline.map((item) => item.id).join(", ")}`));
          child.kill("SIGTERM");
          return;
        }
        onStatus(`Market capabilities · ${report.ready.length} read-only adapters ready · CLI ${report.serverVersion}`);
        writeRequest(SUBSCRIBE_ID, "quote.subscribe", {
          symbols: MARKET_INSTRUMENTS.map((item) => item.vendorSymbol),
          fields: ["quote"],
        });
        return;
      }

      if (message.id === SUBSCRIBE_ID) {
        clearTimeout(startup);
        connected = true;
        const result = objectValue(message.result);
        const initial = Array.isArray(result?.quotes) ? result.quotes : [];
        for (const raw of initial) if (isObject(raw)) mergeQuote(cache.quotes, raw);
        if (!initial.length) {
          requestQuoteSnapshot();
        } else {
          queueActiveIntraday();
        }
        onStatus(`Market feed · subscribed to ${initial.length || MARKET_INSTRUMENTS.length} Hong Kong instruments`);
        queuePublish(true);
        return;
      }

      if (message.id === QUOTE_SNAPSHOT_ID) {
        quoteSnapshotInFlight = false;
        const initial = Array.isArray(message.result) ? message.result : [];
        for (const raw of initial) if (isObject(raw)) mergeQuote(cache.quotes, raw);
        queueActiveIntraday();
        queuePublish(true);
        return;
      }

      const intradaySymbol = message.id === undefined ? undefined : intradayRequests.get(message.id);
      if (intradaySymbol) {
        intradayRequests.delete(message.id!);
        const count = mergeIntraday(cache.quotes, intradaySymbol, Array.isArray(message.result) ? message.result.filter(isObject) : []);
        scheduleIntradayPump(INTRADAY_REQUEST_INTERVAL_MS);
        if (count && intradayRequests.size === 0) {
          onStatus(`Market feed · minute history complete · ${count} latest points · live ticks now extend the current minute`);
        }
        const intradaySnapshot = buildIntradaySnapshot(cache.quotes.get(intradaySymbol), cache.sequence);
        if (intradaySnapshot) {
          publishing = publishing
            .then(() => publishIntraday([intradaySnapshot]))
            .catch((error) => onStatus(`Intraday delivery failed · ${safeMessage(error)}`));
        }
        queuePublish();
        return;
      }

      if (message.method === "quote.updated" && message.params) {
        const vendorSymbol = String(message.params.symbol || "");
        const previous = cache.quotes.get(vendorSymbol);
        const dayRollover = intradayNeedsBackfill(previous, message.params.timestamp);
        if (mergeQuote(cache.quotes, message.params)) {
          mergeLiveIntraday(cache.quotes, message.params, previous);
          if (dayRollover) {
            requestQuoteSnapshot();
            requestedThisSession.delete(vendorSymbol);
            requestIntraday([vendorSymbol]);
          }
          queuePublish();
        }
      }
    });
    child.once("error", (error) => reject(error));
    child.once("exit", (code, signal) => {
      clearInterval(heartbeat);
      clearInterval(demandPoll);
      if (intradayPump) clearTimeout(intradayPump);
      clearTimeout(startup);
      if (publishTimer) clearTimeout(publishTimer);
      reader.close();
      void publishing.finally(() => {
        if (isStopped()) resolve();
        else reject(new Error(`Longbridge process exited (${signal || code || (connected ? "closed" : "not connected")})`));
      });
    });
  });
}

export function mergeQuote(quotes: Map<string, MarketQuoteSnapshot>, raw: RawQuote) {
  const vendorSymbol = String(raw.symbol || "");
  const instrument = MARKET_INSTRUMENT_BY_VENDOR.get(vendorSymbol);
  if (!instrument) return false;
  const previous = quotes.get(vendorSymbol);
  const last = numberValue(raw.last_done, previous?.last ?? 0);
  const prevClose = numberValue(raw.prev_close, previous?.prevClose ?? last);
  if (!last) return false;
  const timestamp = timestampValue(raw.timestamp, previous?.timestamp);
  if (previous && new Date(timestamp).getTime() < new Date(previous.timestamp).getTime()) return false;
  const sameTradingDay = previous && hongKongTradingDay(timestamp) === hongKongTradingDay(previous.timestamp);
  const trail = [...(previous?.trail ?? initialTrail(raw, prevClose, last))];
  if (trail.at(-1) !== last) trail.push(last);
  const change = last - prevClose;
  quotes.set(vendorSymbol, {
    ...instrument,
    last,
    prevClose,
    open: numberValue(raw.open, previous?.open ?? prevClose),
    high: numberValue(raw.high, previous?.high ?? Math.max(last, prevClose)),
    low: numberValue(raw.low, previous?.low ?? Math.min(last, prevClose)),
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    volume: sameTradingDay
      ? Math.max(numberValue(raw.volume, previous.volume), previous.volume)
      : numberValue(raw.volume, previous?.volume ?? 0),
    turnover: sameTradingDay
      ? Math.max(numberValue(raw.turnover, previous.turnover), previous.turnover)
      : numberValue(raw.turnover, previous?.turnover ?? 0),
    timestamp,
    trail: trail.slice(-40),
    intraday: previous?.intraday ?? [],
  });
  return true;
}

/** Merge an incremental quote push into one server-owned current-minute point. */
export function mergeLiveIntraday(
  quotes: Map<string, MarketQuoteSnapshot>,
  raw: RawQuote,
  previous?: MarketQuoteSnapshot,
) {
  const vendorSymbol = String(raw.symbol || "");
  const quote = quotes.get(vendorSymbol);
  const timestamp = validTimestamp(raw.timestamp);
  const price = positiveNumber(raw.last_done);
  if (!quote || !timestamp || price === undefined || !isHongKongTradingMinute(timestamp)) return false;

  const minute = minuteTimestamp(timestamp);
  const tradingDay = hongKongTradingDay(minute);
  const reset = Boolean(previous && hongKongTradingDay(previous.timestamp) !== tradingDay);
  const existing = quote.intraday.filter((point) => hongKongTradingDay(point.timestamp) === tradingDay);
  const tail = existing.at(-1);
  const volumeIncrement = incrementalValue(raw.volume, previous?.volume, raw.current_volume, reset);
  const turnoverIncrement = incrementalValue(raw.turnover, previous?.turnover, raw.current_turnover, reset);

  const point: MarketIntradayPoint = tail?.timestamp === minute
    ? {
        ...tail,
        price,
        volume: tail.volume + volumeIncrement,
        turnover: tail.turnover + turnoverIncrement,
      }
    : {
        timestamp: minute,
        price,
        volume: volumeIncrement,
        turnover: turnoverIncrement,
      };

  const intraday = tail?.timestamp === minute ? [...existing.slice(0, -1), point] : [...existing, point];
  quotes.set(vendorSymbol, {
    ...quote,
    intraday: intraday.slice(-390),
    trail: intraday.slice(-40).map((item) => item.price),
  });
  return true;
}

export function mergeIntraday(quotes: Map<string, MarketQuoteSnapshot>, vendorSymbol: string, rawPoints: RawIntradayPoint[]) {
  const quote = quotes.get(vendorSymbol);
  if (!quote) return 0;
  const backfill = normalizeIntraday(rawPoints);
  if (!backfill.length) return 0;

  const tradingDay = hongKongTradingDay(backfill.at(-1)!.timestamp);
  const lastBackfillTimestamp = backfill.at(-1)!.timestamp;
  const liveTail = quote.intraday.filter((point) =>
    hongKongTradingDay(point.timestamp) === tradingDay && point.timestamp >= lastBackfillTimestamp);
  const merged = new Map(backfill.map((point) => [point.timestamp, point]));
  for (const point of liveTail) merged.set(point.timestamp, point);
  const intraday = [...merged.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-390);

  quotes.set(vendorSymbol, {
    ...quote,
    intraday,
    trail: intraday.slice(-40).map((point) => point.price),
  });
  return intraday.length;
}

export function normalizeIntraday(rawPoints: RawIntradayPoint[]): MarketIntradayPoint[] {
  const points = new Map<string, MarketIntradayPoint>();
  for (const raw of rawPoints) {
    const timestamp = validTimestamp(raw.timestamp);
    const price = positiveNumber(raw.price);
    if (!timestamp || price === undefined) continue;
    const minute = minuteTimestamp(timestamp);
    const averagePrice = positiveNumber(raw.avg_price);
    points.set(minute, {
      timestamp: minute,
      price,
      ...(averagePrice === undefined ? {} : { averagePrice }),
      volume: numberValue(raw.volume, 0),
      turnover: numberValue(raw.turnover, 0),
    });
  }
  return [...points.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-390);
}

export function buildSnapshot(values: MarketQuoteSnapshot[], sequence: number, current = new Date()): MarketSnapshot {
  const sorted = MARKET_INSTRUMENTS.map((item) => values.find((quote) => quote.vendorSymbol === item.vendorSymbol)).filter((quote): quote is MarketQuoteSnapshot => Boolean(quote));
  const marketTimestamp = sorted.reduce((latest, quote) => new Date(quote.timestamp).getTime() > new Date(latest).getTime() ? quote.timestamp : latest, sorted[0]?.timestamp ?? current.toISOString());
  const session = marketSession(current);
  const activeSession = ["morning", "afternoon", "closing"].includes(session);
  const delayed = activeSession && current.getTime() - new Date(marketTimestamp).getTime() > 90_000;
  return {
    source: "longbridge",
    providerLabel: "LONG BRIDGE OPENAPI",
    status: delayed ? "delayed" : "live",
    session,
    receivedAt: current.toISOString(),
    marketTimestamp,
    sequence,
    indices: sorted.filter((quote) => quote.kind === "index").map(compactQuote),
    quotes: sorted.filter((quote) => quote.kind === "equity").map(compactQuote),
  };
}

export function buildIntradaySnapshot(quote: MarketQuoteSnapshot | undefined, sequence: number, current = new Date()): MarketIntradaySnapshot | undefined {
  const points = quote?.intraday ?? [];
  if (!quote || !points.length) return undefined;
  return {
    symbol: quote.symbol,
    vendorSymbol: quote.vendorSymbol,
    tradingDay: hongKongTradingDay(points.at(-1)!.timestamp),
    receivedAt: current.toISOString(),
    sequence,
    points,
  };
}

export function buildActiveIntradaySnapshots(
  quotes: Map<string, MarketQuoteSnapshot>,
  active: Map<string, number>,
  sequence: number,
  current = new Date(),
) {
  const now = current.getTime();
  return [...active]
    .filter(([, expiresAt]) => expiresAt >= now)
    .map(([vendorSymbol]) => buildIntradaySnapshot(quotes.get(vendorSymbol), sequence, current))
    .filter((snapshot): snapshot is MarketIntradaySnapshot => Boolean(snapshot));
}

function compactQuote(quote: MarketQuoteSnapshot): MarketQuoteSnapshot {
  return { ...quote, intraday: [] };
}

export function marketSession(date = new Date()): MarketSession {
  const parts = hongKongParts(date);
  if (["Sat", "Sun"].includes(parts.weekday)) return "closed";
  const minutes = parts.hour * 60 + parts.minute;
  if (minutes < 9 * 60) return "closed";
  if (minutes < 9 * 60 + 30) return "pre-open";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 13 * 60) return "lunch";
  if (minutes < 16 * 60) return "afternoon";
  if (minutes <= 16 * 60 + 10) return "closing";
  return "closed";
}

function intradayNeedsBackfill(quote: MarketQuoteSnapshot | undefined, timestamp: unknown) {
  const valid = validTimestamp(timestamp);
  const latest = quote?.intraday.at(-1)?.timestamp;
  return Boolean(valid && latest && isHongKongTradingMinute(valid) && hongKongTradingDay(valid) !== hongKongTradingDay(latest));
}

function isHongKongTradingMinute(timestamp: string) {
  const parts = hongKongParts(new Date(timestamp));
  if (["Sat", "Sun"].includes(parts.weekday)) return false;
  const minutes = parts.hour * 60 + parts.minute;
  return (minutes >= 9 * 60 + 30 && minutes < 12 * 60)
    || (minutes >= 13 * 60 && minutes <= 16 * 60);
}

function hongKongTradingDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function hongKongParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { weekday: value("weekday"), hour: Number(value("hour")), minute: Number(value("minute")) };
}

function minuteTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  date.setUTCSeconds(0, 0);
  return date.toISOString();
}

function incrementalValue(cumulative: unknown, previous: number | undefined, providedIncrement: unknown, reset: boolean) {
  const total = finiteNonnegative(cumulative);
  if (previous === undefined || total === undefined) return numberValue(providedIncrement, 0);
  if (total >= previous) return total - previous;
  return reset ? numberValue(providedIncrement, total) : 0;
}

function initialTrail(raw: RawQuote, prevClose: number, last: number) {
  return [prevClose, numberValue(raw.open, prevClose), numberValue(raw.low, last), numberValue(raw.high, last), last].filter((value) => value > 0);
}

function numberValue(value: unknown, fallback: number) {
  return finiteNonnegative(value) ?? fallback;
}

function finiteNonnegative(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return undefined;
  const date = typeof value === "number" ? new Date(value > 10_000_000_000 ? value : value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function timestampValue(value: unknown, fallback?: string) {
  return validTimestamp(value) ?? fallback ?? new Date().toISOString();
}

function objectValue(value: unknown) {
  return isObject(value) ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/(?:Bearer\s+|token[=:]\s*)[A-Za-z0-9_.-]+/gi, "[REDACTED]").slice(0, 180);
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
