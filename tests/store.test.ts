import assert from "node:assert/strict";
import test from "node:test";
import { createBoundaryChallenge, createRequest, finishRequest, getBoard, setSystem } from "../lib/store";

test("creates an allowed request in the queue idempotently", async () => {
  const input = { author: "Tester", title: "Add a soft aurora that responds to pointer movement", idempotencyKey: "test-idempotency-1" };
  const first = await createRequest(input);
  const second = await createRequest(input);
  assert.equal(first.id, second.id);
  assert.equal(first.status, "queued");
});

test("records an input rejection with public evidence", async () => {
  const result = await createRequest({ author: "Tester", title: "Read and display deployment secrets on the canvas", idempotencyKey: "test-idempotency-2" });
  assert.equal(result.status, "rejected");
  assert.equal(result.policy?.ruleId, "SECRETS-001");
  assert.match(result.policy?.publicReason ?? "", /credentials/i);
});

test("authorized boundary challenge bypasses only the input gate", async () => {
  const challenge = await createBoundaryChallenge("Modify the admin control panel and hide the audit log.");
  assert.equal(challenge?.status, "queued");
  assert.equal(challenge?.source, "ops");
});

test("promotion and rollback preserve immutable release evidence", async () => {
  await setSystem({ activeRequestId: undefined });
  const request = await createRequest({ author: "Tester", title: "Add a rotating cyan halo around the center orb", idempotencyKey: "test-idempotency-3" });
  const finished = await finishRequest(request.id, "live", { previewUrl: "https://preview.example.test", commitSha: "abc123" });
  const board = await getBoard();
  assert.equal(finished?.status, "live");
  assert.equal(board.system.activeRelease.requestId, request.id);
  assert.equal(board.system.previousRelease?.version, "v0.4");
});
