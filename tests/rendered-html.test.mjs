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
  assert.match(html, /Shape the market/);
  assert.match(html, /Ask about this lab/i);
  assert.match(html, /Every change leaves evidence/);
  assert.match(html, /Autonomous/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders stage, release history, and operator routes", async () => {
  const [stage, releases, ops] = await Promise.all([render("/stage"), render("/releases"), render("/ops")]);
  assert.equal(stage.status, 200);
  assert.equal(releases.status, 200);
  assert.equal(ops.status, 200);
  const stageHtml = await stage.text();
  assert.match(stageHtml, /Current verified market dashboard/i);
  assert.match(stageHtml, /sandbox="allow-scripts allow-pointer-lock allow-same-origin"/i);
  assert.doesNotMatch(stageHtml, /sandbox="[^"]*(allow-forms|allow-popups|allow-top-navigation)/i);
  assert.match(await releases.text(), /See what changed/i);
  assert.match(await ops.text(), /Trusted control plane/i);
});
