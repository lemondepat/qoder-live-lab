import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const icoSignature = Buffer.from([0, 0, 1, 0]);

test("control and showcase publish the Qoder favicon and Apple touch icon", async () => {
  const [layout, showcase] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/showcase/index.html", import.meta.url), "utf8"),
  ]);

  for (const markup of [layout, showcase]) {
    assert.match(markup, /favicon\.ico/);
    assert.match(markup, /qoder-favicon-v2\.png/);
    assert.match(markup, /qoder-apple-touch-icon-v2\.png/);
  }

  const icons = await Promise.all([
    readFile(new URL("../public/qoder-favicon-v2.png", import.meta.url)),
    readFile(new URL("../public/qoder-apple-touch-icon-v2.png", import.meta.url)),
    readFile(new URL("../apps/showcase/public/qoder-favicon-v2.png", import.meta.url)),
    readFile(new URL("../apps/showcase/public/qoder-apple-touch-icon-v2.png", import.meta.url)),
  ]);

  for (const icon of icons) {
    assert.deepEqual(icon.subarray(0, pngSignature.length), pngSignature);
  }

  assert.deepEqual(icons[0], icons[2]);
  assert.deepEqual(icons[1], icons[3]);

  const icoFiles = await Promise.all([
    readFile(new URL("../public/favicon.ico", import.meta.url)),
    readFile(new URL("../apps/showcase/public/favicon.ico", import.meta.url)),
  ]);
  for (const icon of icoFiles) assert.deepEqual(icon.subarray(0, icoSignature.length), icoSignature);
  assert.deepEqual(icoFiles[0], icoFiles[1]);
  await assert.rejects(access(new URL("../public/favicon.svg", import.meta.url)));
});

test("the public header publishes the supplied Qoder line brand", async () => {
  const [page, logo] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/qoder-line.png", import.meta.url)),
  ]);
  assert.match(page, /qoder-line\.png/);
  assert.match(page, />Live Lab</);
  assert.deepEqual(logo.subarray(0, pngSignature.length), pngSignature);
});
