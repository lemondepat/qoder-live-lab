import assert from "node:assert/strict";
import test from "node:test";
import type { ChangeRequest } from "@qoder-live-lab/contracts";
import { isRecentBlockedEvent, STAGE_BLOCKED_DURATION_MS } from "../lib/stage-events";

function blockedAt(timestamp: number): ChangeRequest {
  const date = new Date(timestamp).toISOString();
  return {
    id: "QLL-TEST",
    title: "Protected change",
    author: "Guardrail demo",
    status: "blocked",
    source: "ops",
    createdAt: date,
    updatedAt: date,
    completedAt: date,
    events: [],
  };
}

test("shows only a newly completed blocked event on initial Stage load", () => {
  const now = Date.parse("2026-08-22T00:00:10.000Z");
  assert.equal(isRecentBlockedEvent(blockedAt(now - 1_000), now), true);
  assert.equal(isRecentBlockedEvent(blockedAt(now - STAGE_BLOCKED_DURATION_MS - 1), now), false);
});
