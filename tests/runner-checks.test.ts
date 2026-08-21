import assert from "node:assert/strict";
import test from "node:test";
import { previewHealthFailure, requiredCheckState } from "../apps/runner/src/git-pipeline";

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
