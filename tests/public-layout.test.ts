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
  assert.doesNotMatch(page, /scrollIntoView/);

  assert.match(styles, /body:has\(\.public-v2\).*overflow:hidden/);
  assert.match(styles, /\.public-v2 \[hidden\] \{ display:none!important; \}/);
  assert.match(styles, /\.build-page-v2 \{[\s\S]*?height:calc\(100dvh - 72px\);[\s\S]*?overflow:hidden;/);
  assert.match(styles, /\.pipeline-page-v2 \{ height:calc\(100dvh - 72px\);[\s\S]*?overflow:hidden;/);
  assert.match(styles, /\.pipeline-cards-v2 \{[\s\S]*?overflow-y:auto;/);
  assert.match(styles, /\.pipeline-log-scroll-v2 \{[\s\S]*?overflow-y:auto;/);
});
