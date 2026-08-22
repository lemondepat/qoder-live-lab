import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ChangeRequest } from "@qoder-live-lab/contracts";
import {
  CANDIDATE_SECRET_ENV_KEYS,
  CANDIDATE_VERIFICATION_ARGS,
  CANDIDATE_VERIFICATION_COMMAND,
  candidateVerificationEnvironment,
} from "../apps/runner/src/candidate-verification";
import { buildPrompt } from "../apps/runner/src/qca-provider";

const expectedScript = "npm test && npm run lint && npm run build --workspace @qoder-live-lab/showcase && npm run build";

test("QCA, the trusted Runner, and GitHub use the same candidate verification command", async () => {
  const [packageSource, workflow, testRunner] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/candidate.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/run-tests-isolated.ts", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource) as { scripts: Record<string, string> };

  assert.equal(CANDIDATE_VERIFICATION_COMMAND, "npm run verify:candidate");
  assert.deepEqual(CANDIDATE_VERIFICATION_ARGS, ["run", "verify:candidate"]);
  assert.equal(packageJson.scripts["verify:candidate"], expectedScript);
  assert.equal(packageJson.scripts.test, "tsx scripts/run-tests-isolated.ts");
  assert.match(testRunner, /collectTests\("apps\/showcase\/tests"/);
  assert.match(workflow, /- run: npm run verify:candidate/);
});

test("candidate verification strips production credentials but keeps ordinary build settings", () => {
  const environment = candidateVerificationEnvironment({
    PATH: "/usr/bin",
    NEXT_PUBLIC_SITE_URL: "https://example.test",
    DATABASE_URL: "postgresql://production.example/test",
    GITHUB_TOKEN: "trusted-controller-token",
    VERCEL_TOKEN: "trusted-deployer-token",
  });

  for (const key of CANDIDATE_SECRET_ENV_KEYS) assert.equal(environment[key], undefined);
  assert.equal(environment.PATH, "/usr/bin");
  assert.equal(environment.NEXT_PUBLIC_SITE_URL, "https://example.test");
  assert.equal(environment.SEED_DEMO_DATA, "false");
});

test("QCA must fix candidate-owned verification failures before pushing", () => {
  const request: ChangeRequest = {
    id: "QLL-VERIFY",
    title: "Make the market canvas more visual",
    author: "Test visitor",
    status: "coding",
    source: "public",
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    events: [],
  };
  const prompt = buildPrompt(request, "qll/task-qll-verify");

  assert.match(prompt, /Before committing, run npm run verify:candidate/);
  assert.match(prompt, /fix the candidate, and rerun the full command until it passes/);
  assert.match(prompt, /Do not commit or push a candidate with failing tests, lint, or builds/);
  assert.match(prompt, /docs\/qca\/market-data-capabilities\.md in full/);
  assert.match(prompt, /docs\/qca\/feature-library\.md in full/);
  assert.match(prompt, /Privately evaluate the visitor requirement for a strong or partial semantic match/);
  assert.match(prompt, /deliberately dormant and unreachable from Stage/);
  assert.match(prompt, /There is no \?edition shortcut, preset activation, or controller bypass/);
  assert.match(prompt, /official one-minute Longbridge intraday bars/);
  assert.match(prompt, /never use Web Search/);
});
