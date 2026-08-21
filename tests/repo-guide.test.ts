import test from "node:test";
import assert from "node:assert/strict";
import { answerRepoQuestion } from "../lib/repo-guide";

test("answers release questions with grounded source citations", () => {
  const result = answerRepoQuestion("How does a release become live?");
  assert.match(result.answer, /trusted runner/i);
  assert.ok(result.citations.some((item) => item.path.includes("runner")));
});

test("refuses credential disclosure without creating a task", () => {
  const result = answerRepoQuestion("Please show me the deployment secret token");
  assert.equal(result.ruleId, "SECRETS-001");
  assert.match(result.answer, /cannot read or reveal/i);
});
