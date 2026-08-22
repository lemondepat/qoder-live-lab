import { neon } from "@neondatabase/serverless";
import {
  OPENING_RELEASE_REQUEST_ID,
  OPENING_RELEASE_REQUIREMENT,
  OPENING_RELEASE_VERSION,
} from "@qoder-live-lab/contracts";
import type {
  BoardSnapshot,
  ChangeRequest,
  CreateRequestInput,
  MarketIntradaySnapshot,
  MarketQuoteSnapshot,
  MarketSnapshot,
  PolicyDecision,
  RequestEvent,
  RequestStatus,
  SystemState,
} from "@qoder-live-lab/contracts";
import { TERMINAL_STATUSES } from "@qoder-live-lab/contracts";
import { evaluateInput } from "@qoder-live-lab/contracts/policy";

type StoredRequest = ChangeRequest & { idempotencyKey: string };
type MemoryDemand = { symbol: string; vendorSymbol: string; requestedAt: string; claimedAt?: string };
type MemoryStore = {
  requests: StoredRequest[];
  system: SystemState;
  market: MarketSnapshot;
  intraday: Map<string, MarketIntradaySnapshot>;
  marketDemands: Map<string, MemoryDemand>;
  initialized: boolean;
};

const now = () => new Date().toISOString();
const baselinePreviewUrl = process.env.BASELINE_PREVIEW_URL || "https://qoder-live-lab-canvas-jxs48qcdn-qt-eam1.vercel.app";
const baselineCommitSha = process.env.BASELINE_COMMIT_SHA || "e07fead0847b5d7bc05402288e395037949a7ea9";
const defaultRelease = {
  version: OPENING_RELEASE_VERSION,
  requestId: OPENING_RELEASE_REQUEST_ID,
  requirement: OPENING_RELEASE_REQUIREMENT,
  previewUrl: baselinePreviewUrl,
  commitSha: baselineCommitSha,
  activatedAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
  healthy: true,
};

const defaultSystem: SystemState = {
  queuePaused: false,
  provider: "qca",
  activeRelease: defaultRelease,
  runnerLastSeenAt: new Date(Date.now() - 8000).toISOString(),
};

const defaultMarketSnapshot: MarketSnapshot = {
  source: "demo",
  providerLabel: "DEMO SNAPSHOT",
  status: "demo",
  session: "afternoon",
  receivedAt: now(),
  marketTimestamp: now(),
  sequence: 0,
  indices: [
    demoQuote("HSI", "HSI.HK", "Hang Seng", "Broad market", "index", 25412.8, 25200.71, 0),
    demoQuote("HSTECH", "HSTECH.HK", "Hang Seng TECH", "Technology", "index", 5678.31, 5598.81, 0),
    demoQuote("HSCEI", "HSCEI.HK", "China Enterprises", "China enterprises", "index", 9082.16, 9025.3, 0),
  ],
  quotes: [
    demoQuote("9988", "9988.HK", "Alibaba", "Internet", "equity", 124.8, 121.9, 48_200_000),
    demoQuote("0700", "700.HK", "Tencent", "Internet", "equity", 586.5, 580, 16_800_000),
    demoQuote("3690", "3690.HK", "Meituan", "Consumer", "equity", 132.4, 133.31, 27_100_000),
    demoQuote("1810", "1810.HK", "Xiaomi", "Hardware", "equity", 55.2, 53.57, 102_000_000),
    demoQuote("1211", "1211.HK", "BYD", "Mobility", "equity", 116.7, 118.19, 35_400_000),
    demoQuote("1024", "1024.HK", "Kuaishou", "Media", "equity", 79.6, 79.24, 21_900_000),
  ],
};

const seededRequests: StoredRequest[] = [];

const globalStore = globalThis as typeof globalThis & { __qllStore?: MemoryStore };
const memory = globalStore.__qllStore ??= {
  requests: structuredClone(seededRequests),
  system: structuredClone(defaultSystem),
  market: structuredClone(defaultMarketSnapshot),
  intraday: new Map(),
  marketDemands: new Map(),
  initialized: true,
};
let schemaReady: Promise<void> | undefined;

function databaseUrl() {
  return typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
}

async function ensureSchema() {
  const url = databaseUrl();
  if (!url) return;
  schemaReady ??= (async () => {
    const sql = neon(url);
    await sql`CREATE TABLE IF NOT EXISTS qll_requests (
      id text PRIMARY KEY,
      idempotency_key text UNIQUE NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS qll_system (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS qll_market_snapshot (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS qll_market_intraday (
      vendor_symbol text PRIMARY KEY,
      symbol text NOT NULL,
      trading_day text NOT NULL,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS qll_market_intraday_demand (
      vendor_symbol text PRIMARY KEY,
      symbol text NOT NULL,
      requested_at timestamptz NOT NULL DEFAULT now(),
      claimed_at timestamptz
    )`;
    const existing = await sql`SELECT count(*)::int AS count FROM qll_requests`;
    const count = Number(existing[0]?.count ?? 0);
    if (count === 0 && process.env.SEED_DEMO_DATA === "true") {
      for (const item of seededRequests) {
        await sql`INSERT INTO qll_requests (id, idempotency_key, payload) VALUES (${item.id}, ${item.idempotencyKey}, ${JSON.stringify(item)}::jsonb) ON CONFLICT DO NOTHING`;
      }
    }
    await sql`INSERT INTO qll_system (id, payload) VALUES (1, ${JSON.stringify(defaultSystem)}::jsonb) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO qll_market_snapshot (id, payload) VALUES (1, ${JSON.stringify(defaultMarketSnapshot)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  })();
  return schemaReady;
}

async function readRequests(): Promise<StoredRequest[]> {
  const url = databaseUrl();
  if (!url) return memory.requests;
  await ensureSchema();
  const rows = await neon(url)`SELECT payload FROM qll_requests ORDER BY created_at DESC LIMIT 100`;
  return rows.map((row) => row.payload as StoredRequest);
}

async function readRequest(id: string): Promise<StoredRequest | undefined> {
  const url = databaseUrl();
  if (!url) return memory.requests.find((item) => item.id === id);
  await ensureSchema();
  const rows = await neon(url)`SELECT payload FROM qll_requests WHERE id = ${id} LIMIT 1`;
  return rows[0]?.payload as StoredRequest | undefined;
}

async function readNextQueuedRequest(): Promise<StoredRequest | undefined> {
  const url = databaseUrl();
  if (!url) {
    return memory.requests
      .filter((item) => item.status === "queued")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  }
  await ensureSchema();
  const rows = await neon(url)`SELECT payload FROM qll_requests
    WHERE payload->>'status' = 'queued'
    ORDER BY created_at ASC
    LIMIT 1`;
  return rows[0]?.payload as StoredRequest | undefined;
}

async function writeRequest(request: StoredRequest) {
  const url = databaseUrl();
  if (!url) {
    const index = memory.requests.findIndex((item) => item.id === request.id);
    if (index >= 0) memory.requests[index] = request;
    else memory.requests.unshift(request);
    return;
  }
  await ensureSchema();
  await neon(url)`INSERT INTO qll_requests (id, idempotency_key, payload, updated_at)
    VALUES (${request.id}, ${request.idempotencyKey}, ${JSON.stringify(request)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
}

async function readSystem(): Promise<SystemState> {
  const url = databaseUrl();
  if (!url) return memory.system;
  await ensureSchema();
  const rows = await neon(url)`SELECT payload FROM qll_system WHERE id = 1`;
  return (rows[0]?.payload as SystemState | undefined) ?? defaultSystem;
}

async function writeSystem(system: SystemState) {
  const url = databaseUrl();
  if (!url) { memory.system = system; return; }
  await ensureSchema();
  await neon(url)`INSERT INTO qll_system (id, payload, updated_at) VALUES (1, ${JSON.stringify(system)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
}

export async function getBoard(): Promise<BoardSnapshot> {
  const [requests, system] = await Promise.all([readRequests(), readSystem()]);
  return { requests, system, generatedAt: now() };
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const url = databaseUrl();
  const snapshot = url
    ? await (async () => {
        await ensureSchema();
        const rows = await neon(url)`SELECT payload FROM qll_market_snapshot WHERE id = 1`;
        return (rows[0]?.payload as MarketSnapshot | undefined) ?? defaultMarketSnapshot;
      })()
    : memory.market;
  const compact = compactMarketSnapshot(snapshot);
  if (compact.source === "longbridge" && Date.now() - new Date(compact.receivedAt).getTime() > 45_000) {
    return { ...compact, status: "stale" };
  }
  return compact;
}

export async function writeMarketSnapshot(snapshot: MarketSnapshot): Promise<MarketSnapshot> {
  const embeddedIntraday = [...snapshot.indices, ...snapshot.quotes]
    .map((quote) => quote.intraday.length ? quoteIntradaySnapshot(quote, snapshot.sequence, snapshot.receivedAt) : undefined)
    .filter((item): item is MarketIntradaySnapshot => Boolean(item));
  const compact = compactMarketSnapshot(snapshot);
  const url = databaseUrl();
  if (!url) {
    memory.market = structuredClone(compact);
    await writeMarketIntradaySnapshots(embeddedIntraday);
    return compact;
  }
  await ensureSchema();
  await neon(url)`INSERT INTO qll_market_snapshot (id, payload, updated_at)
    VALUES (1, ${JSON.stringify(compact)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  await writeMarketIntradaySnapshots(embeddedIntraday);
  return compact;
}

export function compactMarketSnapshot(snapshot: MarketSnapshot): MarketSnapshot {
  return {
    ...snapshot,
    indices: snapshot.indices.map((quote) => ({ ...quote, intraday: [] })),
    quotes: snapshot.quotes.map((quote) => ({ ...quote, intraday: [] })),
  };
}

function quoteIntradaySnapshot(quote: MarketQuoteSnapshot, sequence: number, receivedAt: string): MarketIntradaySnapshot {
  const timestamp = quote.intraday.at(-1)?.timestamp ?? quote.timestamp;
  return {
    symbol: quote.symbol,
    vendorSymbol: quote.vendorSymbol,
    tradingDay: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp)),
    receivedAt,
    sequence,
    points: quote.intraday,
  };
}

export async function getMarketIntradaySnapshot(vendorSymbol: string): Promise<MarketIntradaySnapshot | undefined> {
  const url = databaseUrl();
  if (!url) return memory.intraday.get(vendorSymbol);
  await ensureSchema();
  const rows = await neon(url)`SELECT payload FROM qll_market_intraday WHERE vendor_symbol = ${vendorSymbol} LIMIT 1`;
  return rows[0]?.payload as MarketIntradaySnapshot | undefined;
}

export async function writeMarketIntradaySnapshots(snapshots: MarketIntradaySnapshot[]) {
  if (!snapshots.length) return;
  const latest = new Map(snapshots.map((snapshot) => [snapshot.vendorSymbol, snapshot]));
  const url = databaseUrl();
  if (!url) {
    for (const snapshot of latest.values()) {
      memory.intraday.set(snapshot.vendorSymbol, structuredClone(snapshot));
      memory.marketDemands.delete(snapshot.vendorSymbol);
    }
    return;
  }
  await ensureSchema();
  const rows = [...latest.values()].map((snapshot) => ({
    vendor_symbol: snapshot.vendorSymbol,
    symbol: snapshot.symbol,
    trading_day: snapshot.tradingDay,
    payload: snapshot,
  }));
  const sql = neon(url);
  await sql`INSERT INTO qll_market_intraday (vendor_symbol, symbol, trading_day, payload, updated_at)
    SELECT vendor_symbol, symbol, trading_day, payload, now()
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS incoming(vendor_symbol text, symbol text, trading_day text, payload jsonb)
    ON CONFLICT (vendor_symbol) DO UPDATE SET
      symbol = EXCLUDED.symbol,
      trading_day = EXCLUDED.trading_day,
      payload = EXCLUDED.payload,
      updated_at = now()`;
  await sql`DELETE FROM qll_market_intraday_demand
    WHERE vendor_symbol IN (SELECT jsonb_array_elements_text(${JSON.stringify([...latest.keys()])}::jsonb))`;
}

export async function enqueueMarketIntradayDemand(symbol: string, vendorSymbol: string) {
  const url = databaseUrl();
  if (!url) {
    const existing = memory.marketDemands.get(vendorSymbol);
    if (!existing || Date.now() - new Date(existing.requestedAt).getTime() >= 15_000) {
      memory.marketDemands.set(vendorSymbol, { symbol, vendorSymbol, requestedAt: now() });
    }
    return;
  }
  await ensureSchema();
  await neon(url)`INSERT INTO qll_market_intraday_demand (vendor_symbol, symbol, requested_at, claimed_at)
    VALUES (${vendorSymbol}, ${symbol}, now(), NULL)
    ON CONFLICT (vendor_symbol) DO UPDATE SET
      symbol = EXCLUDED.symbol,
      requested_at = now(),
      claimed_at = NULL
    WHERE qll_market_intraday_demand.requested_at < now() - interval '15 seconds'`;
}

export async function claimMarketIntradayDemands(limit = 5): Promise<string[]> {
  const boundedLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  const url = databaseUrl();
  if (!url) {
    const due = [...memory.marketDemands.values()]
      .filter((item) => !item.claimedAt || Date.now() - new Date(item.claimedAt).getTime() >= 30_000)
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
      .slice(0, boundedLimit);
    const claimedAt = now();
    for (const item of due) memory.marketDemands.set(item.vendorSymbol, { ...item, claimedAt });
    return due.map((item) => item.vendorSymbol);
  }
  await ensureSchema();
  const rows = await neon(url)`WITH due AS (
      SELECT vendor_symbol
      FROM qll_market_intraday_demand
      WHERE claimed_at IS NULL OR claimed_at < now() - interval '30 seconds'
      ORDER BY requested_at ASC
      LIMIT ${boundedLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE qll_market_intraday_demand AS demand
    SET claimed_at = now()
    FROM due
    WHERE demand.vendor_symbol = due.vendor_symbol
    RETURNING demand.vendor_symbol`;
  return rows.map((row) => String(row.vendor_symbol));
}

export async function createRequest(input: CreateRequestInput): Promise<ChangeRequest> {
  const requests = await readRequests();
  const existing = requests.find((item) => item.idempotencyKey === input.idempotencyKey);
  if (existing) return existing;
  if (input.source !== "ops" && input.deviceId) {
    const open = requests.find((item) => item.deviceId === input.deviceId && !TERMINAL_STATUSES.has(item.status));
    if (open) throw new RequestLimitError("This device already has a request in progress.");
    const recent = requests.find((item) => item.deviceId === input.deviceId && Date.now() - new Date(item.createdAt).getTime() < 120_000);
    if (recent) throw new RequestLimitError("Please wait two minutes before sending another request.");
  }
  if (requests.filter((item) => !TERMINAL_STATUSES.has(item.status)).length >= 30) throw new RequestLimitError("The live queue is full. Try again shortly.");
  const decision = evaluateInput(input.title);
  const id = `QLL-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const timestamp = now();
  const status: RequestStatus = decision.outcome === "allow" ? "queued" : "rejected";
  const request: StoredRequest = {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    source: input.source ?? "public",
    deviceId: input.deviceId,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
    idempotencyKey: input.idempotencyKey,
    policy: decision.outcome === "allow" ? undefined : decision,
    events: [makeEvent(id, decision.outcome === "allow" ? "status" : "policy", decision.outcome === "allow" ? "Request joined the queue" : `${decision.ruleId} · ${decision.publicReason}`)],
  };
  await writeRequest(request);
  return request;
}

export async function updateRequest(id: string, patch: Partial<ChangeRequest>): Promise<ChangeRequest | undefined> {
  const request = await readRequest(id);
  if (!request) return undefined;
  const next: StoredRequest = { ...request, ...patch, id: request.id, idempotencyKey: request.idempotencyKey, updatedAt: now() };
  await writeRequest(next);
  return next;
}

export async function appendEvent(id: string, input: Pick<RequestEvent, "kind" | "message"> & { providerEventId?: string }) {
  const request = await readRequest(id);
  if (!request) return undefined;
  if (input.providerEventId && request.events.some((event) => event.providerEventId === input.providerEventId)) return request;
  const event = { ...makeEvent(id, input.kind, input.message), providerEventId: input.providerEventId };
  const next: StoredRequest = {
    ...request,
    events: [...request.events, event],
    lastProviderEventId: input.providerEventId ?? request.lastProviderEventId,
    updatedAt: now(),
  };
  await writeRequest(next);
  return next;
}

export async function claimRunnerTask() {
  let system = await readSystem();
  let clearedStaleActive = false;
  const heartbeatAt = now();
  const heartbeatDue = !system.runnerLastSeenAt || Date.now() - new Date(system.runnerLastSeenAt).getTime() >= 10_000;

  if (system.queuePaused) {
    if (heartbeatDue) {
      system = { ...system, runnerLastSeenAt: heartbeatAt };
      await writeSystem(system);
    }
    return { request: undefined, provider: system.provider };
  }

  if (system.activeRequestId) {
    const active = await readRequest(system.activeRequestId);
    if (active && ["coding", "testing", "deploying"].includes(active.status)) {
      if (heartbeatDue) {
        system = { ...system, runnerLastSeenAt: heartbeatAt };
        await writeSystem(system);
      }
      return { request: active, provider: system.provider };
    }
    system = { ...system, activeRequestId: undefined };
    clearedStaleActive = true;
  }

  const next = await readNextQueuedRequest();
  if (!next) {
    if (heartbeatDue || clearedStaleActive) {
      system = { ...system, runnerLastSeenAt: heartbeatAt };
      await writeSystem(system);
    }
    return { request: undefined, provider: system.provider };
  }

  const claimed = await updateRequest(next.id, { status: "coding", startedAt: heartbeatAt });
  system = { ...system, activeRequestId: next.id, runnerLastSeenAt: heartbeatAt };
  await writeSystem(system);
  return { request: claimed, provider: system.provider };
}

export async function claimNextRequest() {
  return (await claimRunnerTask()).request;
}

export async function heartbeatRunner() {
  const system = await readSystem();
  await writeSystem({ ...system, runnerLastSeenAt: now() });
}

export async function setSystem(patch: Partial<SystemState>) {
  const system = await readSystem();
  const next = { ...system, ...patch };
  await writeSystem(next);
  return next;
}

export async function finishRequest(id: string, status: Extract<RequestStatus, "live" | "blocked" | "failed" | "cancelled">, patch: Partial<ChangeRequest> = {}) {
  const completedAt = now();
  const request = await updateRequest(id, { ...patch, status, completedAt });
  const system = await readSystem();
  const nextSystem: SystemState = { ...system, activeRequestId: undefined, runnerLastSeenAt: completedAt };
  if (request && status === "live" && request.previewUrl) {
    const releaseNumbers = (await readRequests())
      .map((item) => releaseNumber(item.releaseVersion))
      .filter((value): value is number => value !== undefined);
    const highestNumber = Math.max(releaseNumber(system.activeRelease.version) ?? 0, ...releaseNumbers);
    const releaseVersion = request.releaseVersion || `v0.${highestNumber + 1}`;
    const liveRequest = await updateRequest(id, { releaseVersion });
    nextSystem.previousRelease = system.activeRelease;
    nextSystem.activeRelease = { version: releaseVersion, requestId: id, requirement: request.title, previewUrl: request.previewUrl, commitSha: request.commitSha, activatedAt: completedAt, healthy: true };
    if (liveRequest) Object.assign(request, liveRequest);
  }
  await writeSystem(nextSystem);
  return request;
}

function releaseNumber(version?: string) {
  const match = version?.match(/^v0\.(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

export async function createBoundaryChallenge(title: string) {
  const request = await createRequest({ author: "Guardrail demo", title, idempotencyKey: `ops-${crypto.randomUUID()}`, source: "ops" });
  if (request.status === "rejected") {
    return updateRequest(request.id, {
      status: "queued",
      policy: undefined,
      events: [...request.events, makeEvent(request.id, "policy", "Input gate bypassed by the authorized guardrail demo")],
    });
  }
  return request;
}

export async function rollbackRelease() {
  const system = await readSystem();
  if (!system.previousRelease) return system;
  const next = { ...system, activeRelease: system.previousRelease, previousRelease: system.activeRelease };
  await writeSystem(next);
  return next;
}

export async function resetOpeningRelease() {
  const system = await readSystem();
  if (system.activeRelease.version === OPENING_RELEASE_VERSION && system.activeRelease.previewUrl === baselinePreviewUrl) return system;
  const next: SystemState = {
    ...system,
    previousRelease: system.activeRelease,
    activeRelease: {
      version: OPENING_RELEASE_VERSION,
      requestId: OPENING_RELEASE_REQUEST_ID,
      requirement: OPENING_RELEASE_REQUIREMENT,
      previewUrl: baselinePreviewUrl,
      commitSha: baselineCommitSha,
      activatedAt: now(),
      healthy: true,
    },
  };
  await writeSystem(next);
  return next;
}

function makeEvent(requestId: string, kind: RequestEvent["kind"], message: string): RequestEvent {
  return { id: `evt-${crypto.randomUUID()}`, requestId, kind, message, createdAt: now() };
}

function demoQuote(
  symbol: string,
  vendorSymbol: string,
  name: string,
  sector: string,
  kind: "index" | "equity",
  last: number,
  prevClose: number,
  volume: number,
) {
  const change = last - prevClose;
  return {
    symbol,
    vendorSymbol,
    name,
    sector,
    kind,
    currency: "HKD",
    last,
    prevClose,
    open: prevClose,
    high: Math.max(last, prevClose),
    low: Math.min(last, prevClose),
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    volume,
    turnover: volume * last,
    timestamp: now(),
    trail: [prevClose, prevClose * 1.002, last * 0.998, last],
    intraday: [],
  };
}

export function publicPolicy(decision: PolicyDecision): PolicyDecision {
  return { ...decision, evidence: decision.evidence.map((item) => item.replace(/\/?Users\/[^/]+/g, "/Users/[REDACTED]")) };
}

export class RequestLimitError extends Error {}
