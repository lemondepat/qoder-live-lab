import { neon } from "@neondatabase/serverless";
import type {
  BoardSnapshot,
  ChangeRequest,
  CreateRequestInput,
  PolicyDecision,
  RequestEvent,
  RequestStatus,
  SystemState,
} from "@qoder-live-lab/contracts";
import { TERMINAL_STATUSES } from "@qoder-live-lab/contracts";
import { evaluateInput } from "@qoder-live-lab/contracts/policy";

type StoredRequest = ChangeRequest & { idempotencyKey: string };
type MemoryStore = { requests: StoredRequest[]; system: SystemState; initialized: boolean };

const now = () => new Date().toISOString();
const defaultRelease = {
  version: "v0.4",
  requestId: "QLL-016",
  requirement: "Create the first Hong Kong market monitor",
  previewUrl: process.env.NEXT_PUBLIC_SHOWCASE_URL || "/showcase",
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

const seededRequests: StoredRequest[] = [
  makeSeed("QLL-018", "Turn the stock list into a sector heatmap", "Mia", "coding", 2),
  makeSeed("QLL-017", "Add five-minute momentum trails", "Noah", "testing", 5),
  { ...makeSeed("QLL-016", "Create the first Hong Kong market monitor", "Lena", "live", 11), releaseVersion: "v0.4", testSummary: "18 tests passed", previewUrl: "/showcase", files: ["apps/showcase/src/Showcase.tsx", "apps/showcase/src/showcase.css"] },
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
const memory = globalStore.__qllStore ??= { requests: structuredClone(seededRequests), system: structuredClone(defaultSystem), initialized: true };
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
    const existing = await sql`SELECT count(*)::int AS count FROM qll_requests`;
    const count = Number(existing[0]?.count ?? 0);
    if (count === 0 && process.env.SEED_DEMO_DATA !== "false") {
      for (const item of seededRequests) {
        await sql`INSERT INTO qll_requests (id, idempotency_key, payload) VALUES (${item.id}, ${item.idempotencyKey}, ${JSON.stringify(item)}::jsonb) ON CONFLICT DO NOTHING`;
      }
    }
    await sql`INSERT INTO qll_system (id, payload) VALUES (1, ${JSON.stringify(defaultSystem)}::jsonb) ON CONFLICT (id) DO NOTHING`;
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
  const request = (await readRequests()).find((item) => item.id === id);
  if (!request) return undefined;
  const next: StoredRequest = { ...request, ...patch, id: request.id, idempotencyKey: request.idempotencyKey, updatedAt: now() };
  await writeRequest(next);
  return next;
}

export async function appendEvent(id: string, input: Pick<RequestEvent, "kind" | "message"> & { providerEventId?: string }) {
  const request = (await readRequests()).find((item) => item.id === id);
  if (!request) return undefined;
  if (input.providerEventId && request.events.some((event) => event.providerEventId === input.providerEventId)) return request;
  const event = { ...makeEvent(id, input.kind, input.message), providerEventId: input.providerEventId };
  return updateRequest(id, { events: [...request.events, event], lastProviderEventId: input.providerEventId ?? request.lastProviderEventId });
}

export async function claimNextRequest() {
  const system = await readSystem();
  if (system.queuePaused) return undefined;
  if (system.activeRequestId) {
    return (await readRequests()).find((item) => item.id === system.activeRequestId && ["coding", "testing", "deploying"].includes(item.status));
  }
  const next = (await readRequests()).filter((item) => item.status === "queued").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!next) return undefined;
  const startedAt = now();
  await updateRequest(next.id, { status: "coding", startedAt });
  await writeSystem({ ...system, activeRequestId: next.id, runnerLastSeenAt: startedAt });
  return { ...next, status: "coding" as const, startedAt };
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

function makeEvent(requestId: string, kind: RequestEvent["kind"], message: string): RequestEvent {
  return { id: `evt-${crypto.randomUUID()}`, requestId, kind, message, createdAt: now() };
}

export function publicPolicy(decision: PolicyDecision): PolicyDecision {
  return { ...decision, evidence: decision.evidence.map((item) => item.replace(/\/?Users\/[^/]+/g, "/Users/[REDACTED]")) };
}

export class RequestLimitError extends Error {}
