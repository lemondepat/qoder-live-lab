import type { ChangeRequest } from "@qoder-live-lab/contracts";

export const STAGE_BLOCKED_DURATION_MS = 8_000;

export function isRecentBlockedEvent(request: ChangeRequest | undefined, now = Date.now()) {
  if (!request || (request.status !== "blocked" && request.status !== "rejected")) return false;
  const timestamp = Date.parse(request.completedAt || request.updatedAt);
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= 0 && age <= STAGE_BLOCKED_DURATION_MS;
}
