import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ChangeRequest } from "@qoder-live-lab/contracts";
import {
  CANDIDATE_VERIFICATION_ARGS,
  CANDIDATE_VERIFICATION_COMMAND,
} from "../apps/runner/src/candidate-verification";
import { buildPrompt } from "../apps/runner/src/qca-provider";

const expectedScript = "npm test && npm run lint && npm run build --workspace @qoder-live-lab/showcase && npm run build";

test("QCA, the trusted Runner, and GitHub use the same candidate verification command", async () => {
  const [packageSource, workflow] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/candidate.yml", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource) as { scripts: Record<string, string> };

  assert.equal(CANDIDATE_VERIFICATION_COMMAND, "npm run verify:candidate");
  assert.deepEqual(CANDIDATE_VERIFICATION_ARGS, ["run", "verify:candidate"]);
  assert.equal(packageJson.scripts["verify:candidate"], expectedScript);
  assert.match(workflow, /- run: npm run verify:candidate/);
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
});
