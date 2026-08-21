import assert from "node:assert/strict";
import test from "node:test";
import { requiredCheckState } from "../apps/runner/src/git-pipeline";

test("does not promote while the required verify check is queued", () => {
  assert.equal(requiredCheckState([
    { name: "Vercel Preview Comments", status: "completed", conclusion: "success" },
    { name: "verify", status: "queued", conclusion: null },
  ]), "pending");
});

test("ignores unrelated green checks until verify appears", () => {
  assert.equal(requiredCheckState([
    { name: "Vercel Preview Comments", status: "completed", conclusion: "success" },
  ]), "missing");
});

test("promotes only after verify succeeds and rejects a failed verify", () => {
  assert.equal(requiredCheckState([
    { name: "verify", status: "completed", conclusion: "success" },
  ]), "success");
  assert.equal(requiredCheckState([
    { name: "verify", status: "completed", conclusion: "failure" },
  ]), "failed");
});
