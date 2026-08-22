import assert from "node:assert/strict";
import test from "node:test";
import { failurePolicy } from "../apps/runner/src/failure-policy";
import { fetchWithRetry, previewHealthFailure, requiredCheckState } from "../apps/runner/src/git-pipeline";

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

test("rejects a Vercel login redirect instead of treating it as a healthy Preview", () => {
  assert.match(previewHealthFailure({
    status: 302,
    contentType: "text/html",
    location: "https://vercel.com/sso-api",
    body: "",
  }) ?? "", /redirect/);
});

test("accepts only the expected public Canvas document", () => {
  assert.equal(previewHealthFailure({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: "<!doctype html><title>Qoder Live Canvas</title><div id=\"root\"></div>",
  }), undefined);
  assert.match(previewHealthFailure({
    status: 200,
    contentType: "text/html",
    body: "<title>Sign in to Vercel</title>",
  }) ?? "", /marker/);
});

test("retries transient Preview network failures before succeeding", async () => {
  let attempts = 0;
  const response = await fetchWithRetry("https://preview.example", {}, {
    attempts: 3,
    initialDelayMs: 0,
    label: "Vercel preview health check",
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) throw new TypeError("fetch failed");
      return new Response("ok", { status: 200 });
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(attempts, 3);
});

test("retries retryable HTTP responses and leaves client errors alone", async () => {
  let serverAttempts = 0;
  const recovered = await fetchWithRetry("https://api.example", {}, {
    attempts: 3,
    initialDelayMs: 0,
    fetchImpl: async () => {
      serverAttempts += 1;
      return new Response("", { status: serverAttempts === 1 ? 503 : 200 });
    },
    sleepImpl: async () => undefined,
  });
  assert.equal(recovered.status, 200);
  assert.equal(serverAttempts, 2);

  let clientAttempts = 0;
  const rejected = await fetchWithRetry("https://api.example", {}, {
    attempts: 3,
    initialDelayMs: 0,
    fetchImpl: async () => {
      clientAttempts += 1;
      return new Response("", { status: 401 });
    },
    sleepImpl: async () => undefined,
  });
  assert.equal(rejected.status, 401);
  assert.equal(clientAttempts, 1);
});

test("classifies an unadorned fetch failure by its active release phase", () => {
  const deployment = failurePolicy(new TypeError("fetch failed"), "deployment");
  assert.equal(deployment.ruleId, "DEPLOYMENT-FAILED");
  assert.equal(deployment.layer, "deployment");

  const ci = failurePolicy(new TypeError("fetch failed"), "ci");
  assert.equal(ci.ruleId, "CI-FAILED");
  assert.equal(ci.layer, "ci");

  const merge = failurePolicy(new Error("GitHub merge failed: HTTP 502"), "deployment");
  assert.equal(merge.ruleId, "CI-FAILED");
  assert.equal(merge.layer, "ci");
});
