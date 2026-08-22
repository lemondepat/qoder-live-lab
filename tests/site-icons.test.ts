import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test("control and showcase publish the Qoder favicon and Apple touch icon", async () => {
  const [layout, showcase] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/showcase/index.html", import.meta.url), "utf8"),
  ]);

  for (const markup of [layout, showcase]) {
    assert.match(markup, /qoder-favicon\.png/);
    assert.match(markup, /qoder-apple-touch-icon\.png/);
  }

  const icons = await Promise.all([
    readFile(new URL("../public/qoder-favicon.png", import.meta.url)),
    readFile(new URL("../public/qoder-apple-touch-icon.png", import.meta.url)),
    readFile(new URL("../apps/showcase/public/qoder-favicon.png", import.meta.url)),
    readFile(new URL("../apps/showcase/public/qoder-apple-touch-icon.png", import.meta.url)),
  ]);

  for (const icon of icons) {
    assert.deepEqual(icon.subarray(0, pngSignature.length), pngSignature);
  }

  assert.deepEqual(icons[0], icons[2]);
  assert.deepEqual(icons[1], icons[3]);
});
