import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the public board expands a complete blocking proof", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /className="pipeline-log-v2"/);
  assert.match(source, /id="latest-blocked-evidence"/);
  assert.match(source, /BOUNDARY EVIDENCE/);
  assert.match(source, /POLICY DECISION/);
  assert.match(source, /0 files promoted/);
  assert.match(source, /Live version unchanged/);
  assert.match(source, /COMMIT · NONE/);
  assert.match(source, /PREVIEW · NONE/);
  assert.doesNotMatch(source, /blocked-strip/);
});
