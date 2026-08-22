import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { MarketQuoteSnapshot, MarketSession, MarketSnapshot } from "@qoder-live-lab/contracts";
import type { RunnerConfig } from "./config";

type Instrument = Pick<MarketQuoteSnapshot, "symbol" | "vendorSymbol" | "name" | "sector" | "kind" | "currency">;
type RawQuote = Record<string, unknown> & { symbol?: string };
type RpcMessage = {
  id?: number;
  method?: string;
  result?: { quotes?: RawQuote[] };
  params?: RawQuote;
  error?: { code?: number; message?: string };
};

export const MARKET_INSTRUMENTS: Instrument[] = [
  { symbol: "HSI", vendorSymbol: "HSI.HK", name: "Hang Seng", sector: "Broad market", kind: "index", currency: "HKD" },
  { symbol: "HSTECH", vendorSymbol: "HSTECH.HK", name: "Hang Seng TECH", sector: "Technology", kind: "index", currency: "HKD" },
  { symbol: "HSCEI", vendorSymbol: "HSCEI.HK", name: "China Enterprises", sector: "China enterprises", kind: "index", currency: "HKD" },
  { symbol: "9988", vendorSymbol: "9988.HK", name: "Alibaba", sector: "Internet", kind: "equity", currency: "HKD" },
  { symbol: "0700", vendorSymbol: "700.HK", name: "Tencent", sector: "Internet", kind: "equity", currency: "HKD" },
  { symbol: "3690", vendorSymbol: "3690.HK", name: "Meituan", sector: "Consumer", kind: "equity", currency: "HKD" },
  { symbol: "1810", vendorSymbol: "1810.HK", name: "Xiaomi", sector: "Hardware", kind: "equity", currency: "HKD" },
  { symbol: "1211", vendorSymbol: "1211.HK", name: "BYD", sector: "Mobility", kind: "equity", currency: "HKD" },
  { symbol: "1024", vendorSymbol: "1024.HK", name: "Kuaishou", sector: "Media", kind: "equity", currency: "HKD" },
];

const instrumentByVendor = new Map(MARKET_INSTRUMENTS.map((instrument) => [instrument.vendorSymbol, instrument]));

export function startMarketFeed(
  config: RunnerConfig,
  publish: (snapshot: MarketSnapshot) => Promise<void>,
  onStatus: (message: string) => void = (message) => process.stdout.write(`${message}\n`),
) {
  if (config.marketFeedProvider !== "longbridge") return { stop() {} };
  let stopped = false;
  let child: ChildProcessWithoutNullStreams | undefined;

  void (async () => {
    let backoffMs = 2_000;
    while (!stopped) {
      try {
        child = spawn(config.longbridgeBinary, ["serve"], { stdio: "pipe" });
        onStatus("Market feed · connecting to Longbridge OpenAPI");
        await runSession(child, config.marketPublishMs, publish, onStatus, () => stopped);
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
    stop() {
      stopped = true;
      if (child?.stdin.writable) child.stdin.end();
      child?.kill("SIGTERM");
    },
  };
}

async function runSession(
  child: ChildProcessWithoutNullStreams,
  publishMs: number,
  publish: (snapshot: MarketSnapshot) => Promise<void>,
  onStatus: (message: string) => void,
  isStopped: () => boolean,
) {
  const quotes = new Map<string, MarketQuoteSnapshot>();
  let sequence = 0;
  let publishTimer: NodeJS.Timeout | undefined;
  let publishing = Promise.resolve();
  let connected = false;
  let lastPublishedAt = 0;
  const cadenceMs = Number.isFinite(publishMs) ? Math.max(250, publishMs) : 20_000;
  const reader = createInterface({ input: child.stdout });

  const queuePublish = (immediate = false) => {
    if (publishTimer) return;
    const run = () => {
      publishTimer = undefined;
      if (!quotes.size || isStopped()) return;
      lastPublishedAt = Date.now();
      sequence += 1;
      const snapshot = buildSnapshot([...quotes.values()], sequence);
      publishing = publishing
        .then(() => publish(snapshot))
        .catch((error) => onStatus(`Market snapshot delivery failed · ${safeMessage(error)}`));
    };
    const elapsed = Date.now() - lastPublishedAt;
    const delay = immediate && lastPublishedAt === 0 ? 0 : Math.max(250, cadenceMs - elapsed);
    if (delay === 0) run();
    else publishTimer = setTimeout(run, delay);
  };

  const heartbeat = setInterval(() => queuePublish(), Math.max(5_000, cadenceMs));
  const startup = setTimeout(() => child.kill("SIGTERM"), 15_000);

  child.stderr.on("data", (chunk) => {
    const message = String(chunk).trim();
    if (message) onStatus(`Longbridge · ${message.replace(/\s+/g, " ").slice(0, 180)}`);
  });

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "quote.subscribe", params: { symbols: MARKET_INSTRUMENTS.map((item) => item.vendorSymbol), fields: ["quote"] } })}\n`);

  return new Promise<void>((resolve, reject) => {
    reader.on("line", (line) => {
      let message: RpcMessage;
      try { message = JSON.parse(line) as RpcMessage; } catch { return; }
      if (message.error) {
        reject(new Error(`Longbridge ${message.error.code ?? "error"}: ${message.error.message ?? "request failed"}`));
        child.kill("SIGTERM");
        return;
      }
      if (message.id === 1) {
        clearTimeout(startup);
        connected = true;
        for (const raw of message.result?.quotes ?? []) mergeQuote(quotes, raw);
        onStatus(`Market feed · subscribed to ${quotes.size || MARKET_INSTRUMENTS.length} Hong Kong instruments`);
        queuePublish(true);
        return;
      }
      if (message.method === "quote.updated" && message.params) {
        mergeQuote(quotes, message.params);
        queuePublish();
      }
    });
    child.once("error", (error) => reject(error));
    child.once("exit", (code, signal) => {
      clearInterval(heartbeat);
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
  const instrument = instrumentByVendor.get(vendorSymbol);
  if (!instrument) return;
  const previous = quotes.get(vendorSymbol);
  const last = numberValue(raw.last_done, previous?.last ?? 0);
  const prevClose = numberValue(raw.prev_close, previous?.prevClose ?? last);
  if (!last) return;
  const timestamp = timestampValue(raw.timestamp, previous?.timestamp);
  if (previous && new Date(timestamp).getTime() < new Date(previous.timestamp).getTime()) return;
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
    volume: numberValue(raw.volume, previous?.volume ?? 0),
    turnover: numberValue(raw.turnover, previous?.turnover ?? 0),
    timestamp,
    trail: trail.slice(-40),
  });
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
    indices: sorted.filter((quote) => quote.kind === "index"),
    quotes: sorted.filter((quote) => quote.kind === "equity"),
  };
}

export function marketSession(date = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  if (["Sat", "Sun"].includes(value("weekday"))) return "closed";
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  if (minutes < 9 * 60) return "closed";
  if (minutes < 9 * 60 + 30) return "pre-open";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 13 * 60) return "lunch";
  if (minutes < 16 * 60) return "afternoon";
  if (minutes <= 16 * 60 + 10) return "closing";
  return "closed";
}

function initialTrail(raw: RawQuote, prevClose: number, last: number) {
  return [prevClose, numberValue(raw.open, prevClose), numberValue(raw.low, last), numberValue(raw.high, last), last].filter((value) => value > 0);
}

function numberValue(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function timestampValue(value: unknown, fallback?: string) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback ?? new Date().toISOString();
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/(?:Bearer\s+|token[=:]\s*)[A-Za-z0-9_.-]+/gi, "[REDACTED]").slice(0, 180);
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
