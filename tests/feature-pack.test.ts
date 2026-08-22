import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ChangeRequest } from "@qoder-live-lab/contracts";
import { loadConfig } from "../apps/runner/src/config";
import { featurePackSource, materializeFeaturePack, resolveFeaturePack } from "../apps/runner/src/feature-pack";
import { REHEARSAL_FEATURES } from "../packages/contracts/src/features";
import { FEATURE_EDITIONS } from "../apps/showcase/src/feature-pack";

test("the checked-in baseline is generated from the same signed activation template", async () => {
  const checkedIn = await readFile(new URL("../apps/showcase/src/feature-pack.ts", import.meta.url), "utf8");
  assert.equal(checkedIn, featurePackSource("baseline", "OWNER-BASELINE"));
  assert.equal(resolveFeaturePack("sector-heatmap").title, "Sector Heatmap");
  assert.deepEqual(FEATURE_EDITIONS.slice(1), REHEARSAL_FEATURES.map((feature) => feature.id));
  assert.throws(() => resolveFeaturePack("visitor-script"), /unsigned/i);
});

test("materializes one signed canvas file on an isolated GitHub task branch", async () => {
  const request: ChangeRequest = {
    id: "QLL-PACK01",
    title: "Activate the signed heatmap",
    author: "Stage operator",
    status: "coding",
    source: "ops",
    presetFeatureId: "sector-heatmap",
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    events: [],
  };
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const responses = [
    { object: { sha: "base-sha" } },
    { tree: { sha: "base-tree" } },
    { sha: "blob-sha" },
    { sha: "tree-sha" },
    { sha: "candidate-sha" },
    { ref: "refs/heads/qll/task-qll-pack01" },
  ];
  const fetchImpl = async (input: string | URL, init: RequestInit = {}) => {
    calls.push({
      url: String(input),
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined,
    });
    return Response.json(responses[calls.length - 1], { status: 200 });
  };
  const config = {
    ...loadConfig(),
    dryRun: false,
    githubRepositoryUrl: "https://github.com/lemondepat/qoder-live-lab",
    githubToken: "trusted-controller-token",
    githubDefaultBranch: "main",
  };

  const result = await materializeFeaturePack(request, "qll/task-qll-pack01", config, fetchImpl);

  assert.equal(result.commitSha, "candidate-sha");
  assert.equal(calls.length, 6);
  assert.match(String(calls[2]?.body?.content), /DEFAULT_FEATURE_EDITION: FeatureEdition = "sector-heatmap"/);
  assert.equal(calls[3]?.body?.base_tree, "base-tree");
  assert.deepEqual(calls[4]?.body?.parents, ["base-sha"]);
  assert.deepEqual(calls[5]?.body, { ref: "refs/heads/qll/task-qll-pack01", sha: "candidate-sha" });
});
