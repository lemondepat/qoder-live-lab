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
  MarketSnapshot,
  PolicyDecision,
  RequestEvent,
  RequestStatus,
  SystemState,
} from "@qoder-live-lab/contracts";
import { TERMINAL_STATUSES } from "@qoder-live-lab/contracts";
import { evaluateInput } from "@qoder-live-lab/contracts/policy";

type StoredRequest = ChangeRequest & { idempotencyKey: string };
type MemoryStore = { requests: StoredRequest[]; system: SystemState; market: MarketSnapshot; initialized: boolean };

const now = () => new Date().toISOString();
const baselinePreviewUrl = process.env.BASELINE_PREVIEW_URL || "https://qoder-live-lab-canvas-arlg3imwb-qt-eam1.vercel.app";
const baselineCommitSha = process.env.BASELINE_COMMIT_SHA || "9aaacd682f562a43a63d2b2f734e9fc626a89a8f";
const defaultRelease = {
  version: OPENING_RELEASE_VERSION,
  requestId: OPENING_RELEASE_REQUEST_ID,
  requirement: OPENING_RELEASE_REQUIREMENT,
  previewUrl: baselinePreviewUrl,
  activatedAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
  healthy: true,
};

const defaultSystem: SystemState = {
  queuePaused: false,
  provider: "qca",
  activeRequestId: "QLL-018",
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

const seededRequests: StoredRequest[] = [
  makeSeed("QLL-018", "Turn the stock list into a sector heatmap", "Mia", "coding", 2),
  makeSeed("QLL-017", "Add five-minute momentum trails", "Noah", "testing", 5),
  { ...makeSeed(OPENING_RELEASE_REQUEST_ID, OPENING_RELEASE_REQUIREMENT, "Qoder Live Lab", "live", 11), releaseVersion: OPENING_RELEASE_VERSION, testSummary: "Longbridge feed · policy · tests · build verified", previewUrl: baselinePreviewUrl, commitSha: baselineCommitSha, files: ["apps/showcase/src/Showcase.tsx", "apps/showcase/src/market-feed.ts", "apps/showcase/src/showcase.css"], policy: openingReleasePolicy() },
  {
    ...makeSeed("QLL-015", "Modify the admin control panel", "Guardrail demo", "blocked", 15),
    policy: { outcome: "block", layer: "changeset", ruleId: "SCOPE-001", publicReason: "The control plane is protected.", evidence: ["Protected path: apps/control/app/page.tsx", "0 files promoted"] },
  },
];

function makeSeed(id: string, title: string, author: string, status: RequestStatus, minutesAgo: number): StoredRequest {
  const timestamp = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id, title, author, status, source: status === "blocked" ? "ops" : "public",
    createdAt: timestamp, updatedAt: timestamp, idempotencyKey: `seed-${id}`,
    events: [{ id: `evt-${id}`, requestId: id, kind: "status", message: status === "live" ? "Release activated" : status === "blocked" ? "Candidate stopped by policy" : `Task entered ${status}`, createdAt: timestamp }],
  };
}

const globalStore = globalThis as typeof globalThis & { __qllStore?: MemoryStore };
const memory = globalStore.__qllStore ??= { requests: structuredClone(seededRequests), system: structuredClone(defaultSystem), market: structuredClone(defaultMarketSnapshot), initialized: true };
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
    const existing = await sql`SELECT count(*)::int AS count FROM qll_requests`;
    const count = Number(existing[0]?.count ?? 0);
    if (count === 0 && process.env.SEED_DEMO_DATA !== "false") {
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
  if (snapshot.source === "longbridge" && Date.now() - new Date(snapshot.receivedAt).getTime() > 45_000) {
    return { ...snapshot, status: "stale" };
  }
  return snapshot;
}

export async function writeMarketSnapshot(snapshot: MarketSnapshot): Promise<MarketSnapshot> {
  const url = databaseUrl();
  if (!url) {
    memory.market = structuredClone(snapshot);
    return snapshot;
  }
  await ensureSchema();
  await neon(url)`INSERT INTO qll_market_snapshot (id, payload, updated_at)
    VALUES (1, ${JSON.stringify(snapshot)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  return snapshot;
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
    const currentNumber = Number(system.activeRelease.version.replace(/\D/g, "")) || 0;
    const releaseVersion = request.releaseVersion || `v0.${currentNumber + 1}`;
    const liveRequest = await updateRequest(id, { releaseVersion });
    nextSystem.previousRelease = system.activeRelease;
    nextSystem.activeRelease = { version: releaseVersion, requestId: id, requirement: request.title, previewUrl: request.previewUrl, commitSha: request.commitSha, activatedAt: completedAt, healthy: true };
    if (liveRequest) Object.assign(request, liveRequest);
  }
  await writeSystem(nextSystem);
  return request;
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

export async function createRehearsalFeature(feature: { id: string; request: string }) {
  const request = await createRequest({ author: "Stage operator", title: feature.request, idempotencyKey: `feature-${feature.id}-${crypto.randomUUID()}`, source: "ops" });
  return updateRequest(request.id, {
    presetFeatureId: feature.id,
    events: [...request.events, makeEvent(request.id, "status", `Signed rehearsal feature selected · ${feature.id}`)],
  });
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
  let baseline = (await readRequests()).find((item) => item.releaseVersion === OPENING_RELEASE_VERSION || item.id === OPENING_RELEASE_REQUEST_ID);
  if (!baseline) {
    const timestamp = now();
    baseline = {
      id: OPENING_RELEASE_REQUEST_ID,
      idempotencyKey: `opening-${OPENING_RELEASE_VERSION}`,
      title: OPENING_RELEASE_REQUIREMENT,
      author: "Qoder Live Lab",
      source: "ops",
      status: "live",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
      releaseVersion: OPENING_RELEASE_VERSION,
      previewUrl: baselinePreviewUrl,
      commitSha: baselineCommitSha,
      files: ["apps/showcase/src/Showcase.tsx", "apps/showcase/src/market-feed.ts", "apps/showcase/src/showcase.css"],
      testSummary: "Longbridge feed · policy · tests · build verified",
      policy: openingReleasePolicy(),
      events: [makeEvent(OPENING_RELEASE_REQUEST_ID, "release", "Trusted Longbridge opening release activated")],
    };
    await writeRequest(baseline);
  }
  await updateRequest(baseline.id, { previewUrl: baselinePreviewUrl, releaseVersion: OPENING_RELEASE_VERSION, commitSha: baselineCommitSha });
  if (system.activeRelease.version === OPENING_RELEASE_VERSION && system.activeRelease.previewUrl === baselinePreviewUrl) return system;
  const next: SystemState = {
    ...system,
    previousRelease: system.activeRelease,
    activeRelease: {
      version: OPENING_RELEASE_VERSION,
      requestId: baseline.id,
      requirement: baseline.title,
      previewUrl: baselinePreviewUrl,
      commitSha: baselineCommitSha,
      activatedAt: baseline.completedAt || baseline.updatedAt,
      healthy: true,
    },
  };
  await writeSystem(next);
  return next;
}

function openingReleasePolicy(): PolicyDecision {
  return {
    outcome: "allow",
    layer: "deployment",
    ruleId: "OWNER-BASELINE",
    publicReason: "The opening release passed the trusted owner maintenance path.",
    evidence: ["Longbridge market feed verified", "36 tests passed", "Immutable Vercel Preview healthy"],
  };
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
  };
}

export function publicPolicy(decision: PolicyDecision): PolicyDecision {
  return { ...decision, evidence: decision.evidence.map((item) => item.replace(/\/?Users\/[^/]+/g, "/Users/[REDACTED]")) };
}

export class RequestLimitError extends Error {}
