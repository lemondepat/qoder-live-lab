import assert from "node:assert/strict";
import test from "node:test";
import { OPENING_RELEASE_VERSION } from "../packages/contracts/src/index";
import { createBoundaryChallenge, createRequest, finishRequest, getBoard, getMarketSnapshot, resetOpeningRelease, setSystem, writeMarketSnapshot } from "../lib/store";

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
  assert.equal(board.system.previousRelease?.version, OPENING_RELEASE_VERSION);
});

test("resets the Stage to the immutable, intentionally simple opening release", async () => {
  await resetOpeningRelease();
  const board = await getBoard();
  assert.equal(board.system.activeRelease.version, OPENING_RELEASE_VERSION);
  assert.match(board.system.activeRelease.previewUrl, /qoder-live-lab-canvas-arlg3imwb/);
  assert.notEqual(board.system.previousRelease?.version, OPENING_RELEASE_VERSION);
});

test("persists a sanitized Longbridge snapshot for the public read path", async () => {
  const timestamp = new Date().toISOString();
  await writeMarketSnapshot({
    source: "longbridge",
    providerLabel: "LONG BRIDGE OPENAPI",
    status: "live",
    session: "afternoon",
    receivedAt: timestamp,
    marketTimestamp: timestamp,
    sequence: 7,
    indices: [],
    quotes: [{ symbol: "0700", vendorSymbol: "700.HK", name: "Tencent", sector: "Internet", kind: "equity", currency: "HKD", last: 448.6, prevClose: 442.4, open: 438.2, high: 450, low: 437.8, change: 6.2, changePercent: 1.4, volume: 12_441_624, turnover: 5_570_000_000, timestamp, trail: [442.4, 448.6] }],
  });
  const snapshot = await getMarketSnapshot();
  assert.equal(snapshot.source, "longbridge");
  assert.equal(snapshot.sequence, 7);
  assert.equal(snapshot.quotes[0]?.last, 448.6);
});

test("keeps a twenty-second market cadence healthy and flags missed snapshots", async () => {
  const base = {
    source: "longbridge" as const,
    providerLabel: "LONG BRIDGE OPENAPI",
    status: "live" as const,
    session: "afternoon" as const,
    marketTimestamp: new Date().toISOString(),
    sequence: 8,
    indices: [],
    quotes: [],
  };

  await writeMarketSnapshot({ ...base, receivedAt: new Date(Date.now() - 30_000).toISOString() });
  assert.equal((await getMarketSnapshot()).status, "live");

  await writeMarketSnapshot({ ...base, receivedAt: new Date(Date.now() - 46_000).toISOString() });
  assert.equal((await getMarketSnapshot()).status, "stale");
});
