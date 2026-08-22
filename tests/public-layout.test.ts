import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the public experience is a fixed-screen nav switcher", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /aria-pressed=\{activePage === "build"\}/);
  assert.match(page, /aria-pressed=\{activePage === "pipeline"\}/);
  assert.match(page, /hidden=\{activePage !== "build"\}/);
  assert.match(page, /hidden=\{activePage !== "pipeline"\}/);
  assert.match(page, /selectPage\("pipeline"\)/);
  assert.match(page, /label: "You Ask"/);
  assert.match(page, /label: "Qoder Builds"/);
  assert.match(page, /label: "Qoder Verifies"/);
  assert.match(page, /label: "Qoder Deploys"/);
  assert.match(page, /key: "deploying", statuses: \["deploying"\]/);
  assert.match(page, /QODER CLOUD AGENT PROGRESS/);
  assert.match(page, /label: "Failed Changes"/);
  assert.doesNotMatch(page, /02 \/ LIVE PIPELINE/);
  assert.match(page, /aria-label="Live Pipeline"/);
  assert.doesNotMatch(page, /pipeline-heading-v2/);
  assert.match(page, /aria-haspopup="dialog"/);
  assert.match(page, /role="dialog" aria-modal="true"/);
  assert.match(page, /VERSION EVIDENCE/);
  assert.doesNotMatch(page, /href="\/releases"/);
  assert.doesNotMatch(page, /scrollIntoView/);
  assert.doesNotMatch(page, /page-proof-v2/);

  assert.match(styles, /body:has\(\.public-v2\).*overflow:hidden/);
  assert.doesNotMatch(styles, /page-proof-v2/);
  assert.match(styles, /\.public-v2 \[hidden\] \{ display:none!important; \}/);
  assert.match(styles, /\.build-page-v2 \{[\s\S]*?height:calc\(100dvh - 72px\);[\s\S]*?overflow:hidden;/);
  assert.match(styles, /\.pipeline-page-v2 \{ height:calc\(100dvh - 72px\);[\s\S]*?grid-template-rows:minmax\(0,1fr\);[\s\S]*?padding:0;[\s\S]*?overflow:hidden;/);
  assert.doesNotMatch(styles, /pipeline-heading-v2|pipeline-signal-v2|pipeline-meta-v2|mobile-board-hint-v2/);
  assert.match(styles, /\.pipeline-cards-v2 \{[\s\S]*?overflow-y:auto;/);
  assert.match(styles, /\.pipeline-board-v2 \{[\s\S]*?grid-template-columns:repeat\(6,/);
  assert.match(styles, /\.pipeline-lane-v2\.lane-deploying>header i/);
  assert.match(styles, /\.ticket-modal-scroll-v2 \{[\s\S]*?overflow-y:auto;/);
  assert.doesNotMatch(styles, /pipeline-log-v2/);
});

test("the public experience protects phone scan, keyboard, and touch workflows", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /autoComplete="nickname"/);
  assert.match(page, /swipe horizontally on mobile/);
  assert.match(page, /aria-label=\{`\$\{lane\.label\} requests`\}/);

  assert.match(styles, /@media\(max-width:600px\) and \(orientation:portrait\)/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.turn-name-v2 input \{[\s\S]*?font-size:16px;/);
  assert.match(styles, /:has\(\.turn-name-v2 input:focus,\.turn-request-v2 textarea:focus\)/);
  assert.match(styles, /scroll-snap-type:x mandatory/);
  assert.match(styles, /scroll-snap-stop:always/);
  assert.match(styles, /-webkit-overflow-scrolling:touch/);
  assert.match(styles, /@media\(max-width:900px\) and \(max-height:520px\) and \(orientation:landscape\)/);
});

test("the Stage bar matches the public header height", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.stage-shell \{[^}]*grid-template-rows:72px 1fr;/);
  assert.match(styles, /\.public-header-v2 \{[\s\S]*?height:72px;/);
  assert.match(styles, /@media\(max-width:760px\)\{[\s\S]*?\.stage-shell\{grid-template-rows:64px 1fr\}/);
  assert.match(styles, /@media\(max-width:820px\) \{[\s\S]*?\.public-header-v2 \{ height:64px;/);
});
