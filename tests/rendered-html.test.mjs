import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const port = 41000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/board`);
      if (response.ok) return;
    } catch {
      // The production server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Next.js server did not become ready");
}

test.before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, SEED_DEMO_DATA: "true" },
    stdio: "ignore",
  });
  await waitForServer();
});

test.after(() => {
  server?.kill("SIGTERM");
});

function render(path = "/") {
  return fetch(`${baseUrl}${path}`, { headers: { accept: "text/html" } });
}

test("server-renders the Qoder Live Lab public board", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Qoder Live Lab<\/title>/i);
  assert.match(html, /href="\/favicon\.ico"/i);
  assert.match(html, /href="\/qoder-favicon-v2\.png"/i);
  assert.doesNotMatch(html, /favicon\.svg/i);
  assert.match(html, /Ask for a change/);
  assert.doesNotMatch(html, /01 \/ BUILD IN PUBLIC/);
  assert.match(html, /One bounded Qoder Cloud Agent\./);
  assert.match(html, /QODER VERIFIES/);
  assert.match(html, /QODER DEPLOYS/);
  assert.doesNotMatch(html, /POLICY VERIFIES/);
  assert.doesNotMatch(html, /02 \/ LIVE PIPELINE/);
  assert.match(html, /What should the market become next/);
  assert.doesNotMatch(html, /Ask about this lab/i);
  assert.match(html, /qoder-line\.png/);
  assert.match(html, /Live Pipeline/i);
  assert.match(html, /Failed Changes/i);
  assert.doesNotMatch(html, /Change log/i);
  assert.doesNotMatch(html, /Long\s*Bridge/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders stage and operator routes and folds versions into the pipeline", async () => {
  const [stage, releases, ops] = await Promise.all([render("/stage"), render("/releases"), render("/ops")]);
  assert.equal(stage.status, 200);
  assert.equal(releases.status, 200);
  assert.equal(ops.status, 200);
  const stageHtml = await stage.text();
  const opsHtml = await ops.text();
  assert.match(stageHtml, /Current verified market dashboard/i);
  assert.match(stageHtml, /stage-brand/i);
  assert.match(stageHtml, /qoder-line\.png/i);
  assert.match(stageHtml, /Live Lab/i);
  assert.match(stageHtml, /sandbox="allow-scripts allow-pointer-lock allow-same-origin"/i);
  assert.doesNotMatch(stageHtml, /Long\s*Bridge/i);
  assert.doesNotMatch(stageHtml, /sandbox="[^"]*(allow-forms|allow-popups|allow-top-navigation)/i);
  assert.match(await releases.text(), /Live Pipeline/i);
  assert.match(opsHtml, /Trusted control plane/i);
  assert.match(opsHtml, /qoder-brand-icon/i);
});
