import assert from "node:assert/strict";
import test from "node:test";
import { consumeSse, githubSessionResource, parseFrame, publicProgress, sessionIsIdle } from "../apps/runner/src/qca-provider";
import { DEFAULT_AGENT_TIMEOUT_MS, DEFAULT_TOTAL_TIMEOUT_MS, loadConfig } from "../apps/runner/src/config";

test("reserves twenty minutes for QCA and five minutes for release checks", () => {
  const previousAgentTimeout = process.env.AGENT_TIMEOUT_MS;
  const previousTotalTimeout = process.env.TASK_TIMEOUT_MS;
  delete process.env.AGENT_TIMEOUT_MS;
  delete process.env.TASK_TIMEOUT_MS;
  try {
    const config = loadConfig();
    assert.equal(config.taskTimeoutMs, DEFAULT_AGENT_TIMEOUT_MS);
    assert.equal(config.totalTimeoutMs, DEFAULT_TOTAL_TIMEOUT_MS);
    assert.equal(config.taskTimeoutMs, 1_200_000);
    assert.equal(config.totalTimeoutMs, 1_500_000);
    assert.equal(config.marketPublishMs, 20_000);
    assert.equal("marketIntradayRefreshMs" in config, false);
  } finally {
    if (previousAgentTimeout === undefined) delete process.env.AGENT_TIMEOUT_MS;
    else process.env.AGENT_TIMEOUT_MS = previousAgentTimeout;
    if (previousTotalTimeout === undefined) delete process.env.TASK_TIMEOUT_MS;
    else process.env.TASK_TIMEOUT_MS = previousTotalTimeout;
  }
});

test("uses the current GitHub session resource shape", () => {
  const resource = githubSessionResource({
    ...loadConfig(),
    githubRepositoryUrl: "https://github.com/example/repo",
    qoderGithubToken: "candidate-token",
    githubToken: "trusted-controller-token",
  });
  assert.equal(resource.type, "github_repository");
  assert.equal(resource.url, "https://github.com/example/repo");
  assert.equal(resource.authorization_token, "candidate-token");
  assert.notEqual(resource.authorization_token, "trusted-controller-token");
  assert.equal("checkout" in resource, false);
});

test("parses a QCA SSE frame and keeps its cursor", () => {
  const frame = parseFrame('id: evt_123\nevent: agent.message\ndata: {"content":[{"type":"text","text":"Candidate ready"}]}');
  assert.equal(frame?.id, "evt_123");
  assert.equal(frame?.event, "agent.message");
});

test("keeps the last cursor when a QCA stream is transiently terminated", async () => {
  const encoder = new TextEncoder();
  const progress: string[] = [];
  let reads = 0;
  const stream = { getReader: () => ({
    read: async () => {
      if (reads++ === 0) return { value: encoder.encode('id: evt_terminated\nevent: agent.tool_use\ndata: {"name":"Edit"}\n\n'), done: false };
      throw new TypeError("terminated");
    },
    cancel: async () => undefined,
  }) } as unknown as ReadableStream<Uint8Array>;

  const result = await consumeSse(stream, async (event) => { progress.push(event.message); });

  assert.equal(result.cursor, "evt_terminated");
  assert.equal(result.interrupted, true);
  assert.deepEqual(progress, ["Updating candidate files"]);
});

test("never exposes thinking events", () => {
  assert.equal(publicProgress("agent.thinking", { content: [{ type: "text", text: "private reasoning" }] }, "evt_1"), undefined);
});

test("maps tool use to a readable public milestone", () => {
  assert.equal(publicProgress("agent.tool_use", { tool_name: "Edit" }, "evt_2")?.message, "Updating candidate files");
});

test("maps the current QCA tool name field to a readable public milestone", () => {
  assert.equal(publicProgress("agent.tool_use", { name: "Read" }, "evt_2b")?.message, "Inspecting the market canvas");
});

test("stops a turn only at session idle", () => {
  assert.equal(publicProgress("session.status_idle", {}, "evt_3")?.idle, true);
});

test("recognizes an agent boundary refusal without exposing reasoning", () => {
  const progress = publicProgress("agent.message", { content: [{ type: "text", text: "DECLINED: the request targets a protected path." }] }, "evt_4");
  assert.equal(progress?.declined, true);
  assert.match(progress?.message ?? "", /DECLINED/);
});

test("recognizes an already-idle persisted session during resume", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "idle" }), { status: 200 });
  try {
    const idle = await sessionIsIdle("sess_resume", {
      ...loadConfig(),
      qoderPat: "qoder-pat",
      qoderAgentId: "agent-id",
      qoderEnvironmentId: "environment-id",
      githubRepositoryUrl: "https://github.com/example/repo",
      qoderGithubToken: "candidate-token",
    });
    assert.equal(idle, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
