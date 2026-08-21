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
