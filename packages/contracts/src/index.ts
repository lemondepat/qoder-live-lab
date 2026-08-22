export const REQUEST_STATUSES = [
  "queued",
  "coding",
  "testing",
  "deploying",
  "live",
  "rejected",
  "blocked",
  "failed",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type PolicyOutcome = "allow" | "reject" | "block";
export type PolicyLayer = "input" | "agent" | "changeset" | "ci" | "deployment";

export type PolicyDecision = {
  outcome: PolicyOutcome;
  layer: PolicyLayer;
  ruleId: string;
  publicReason: string;
  evidence: string[];
};

export type RequestEvent = {
  id: string;
  requestId: string;
  kind: "status" | "agent" | "test" | "policy" | "release";
  message: string;
  createdAt: string;
  providerEventId?: string;
};

export type ChangeRequest = {
  id: string;
  title: string;
  author: string;
  status: RequestStatus;
  source: "public" | "ops";
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  qcaSessionId?: string;
  qcaPromptSentAt?: string;
  lastProviderEventId?: string;
  branch?: string;
  commitSha?: string;
  pullRequestUrl?: string;
  previewUrl?: string;
  releaseVersion?: string;
  files?: string[];
  testSummary?: string;
  presetFeatureId?: string;
  policy?: PolicyDecision;
  events: RequestEvent[];
};

export type Release = {
  version: string;
  requestId: string;
  requirement: string;
  previewUrl: string;
  commitSha?: string;
  activatedAt: string;
  healthy: boolean;
};

export type SystemState = {
  queuePaused: boolean;
  provider: "qca" | "local";
  activeRequestId?: string;
  activeRelease: Release;
  previousRelease?: Release;
  runnerLastSeenAt?: string;
};

export type BoardSnapshot = {
  requests: ChangeRequest[];
  system: SystemState;
  generatedAt: string;
};

export const OPENING_RELEASE_VERSION = "v0.7";
export const OPENING_RELEASE_REQUEST_ID = "QLL-OPEN07";
export const OPENING_RELEASE_REQUIREMENT = "Connect the intentionally simple canvas to trusted Longbridge market data";

export type MarketFeedStatus = "live" | "delayed" | "stale" | "demo" | "offline";
export type MarketSession = "pre-open" | "morning" | "lunch" | "afternoon" | "closing" | "closed";

export type MarketIntradayPoint = {
  timestamp: string;
  price: number;
  averagePrice?: number;
  volume: number;
  turnover: number;
};

export type MarketQuoteSnapshot = {
  symbol: string;
  vendorSymbol: string;
  name: string;
  sector: string;
  kind: "index" | "equity";
  currency: string;
  last: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  timestamp: string;
  trail: number[];
  intraday: MarketIntradayPoint[];
};

export type MarketSnapshot = {
  source: "longbridge" | "demo";
  providerLabel: string;
  status: MarketFeedStatus;
  session: MarketSession;
  receivedAt: string;
  marketTimestamp: string;
  sequence: number;
  indices: MarketQuoteSnapshot[];
  quotes: MarketQuoteSnapshot[];
};

export type CreateRequestInput = {
  author: string;
  title: string;
  idempotencyKey: string;
  source?: "public" | "ops";
  deviceId?: string;
};

export const TERMINAL_STATUSES = new Set<RequestStatus>([
  "live",
  "rejected",
  "blocked",
  "failed",
  "cancelled",
]);

export const PUBLIC_LANES: Record<RequestStatus, string> = {
  queued: "Queue",
  coding: "Building",
  testing: "Verifying",
  deploying: "Deploying",
  live: "Shipped",
  rejected: "Guardrails",
  blocked: "Guardrails",
  failed: "Needs attention",
  cancelled: "Cancelled",
};
