import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the ticket popup includes a complete blocking proof", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /className={`ticket-modal-v2 status-\$\{card\.status\}`}/);
  assert.match(source, /VERSION EVIDENCE/);
  assert.match(source, /POLICY/);
  assert.match(source, /0 FILES PROMOTED/);
  assert.match(source, /Live version unchanged/);
  assert.match(source, /IMMUTABLE PREVIEW/);
  assert.doesNotMatch(source, /pipeline-log-v2/);
  assert.doesNotMatch(source, /blocked-strip/);
});
