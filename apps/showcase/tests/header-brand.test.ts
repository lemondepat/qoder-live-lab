import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const showcase = readFileSync(fileURLToPath(new URL("../src/RichShowcase.tsx", import.meta.url)), "utf8");

test("header brand shows the Hong Kong market pulse label", () => {
  const brand = showcase.match(/<div className="market-brand">[\s\S]*?<\/div><\/div>/);
  assert.ok(brand, "market-brand wrapper should exist");
  assert.match(brand![0], /<b>HONG KONG MARKET PULSE<\/b>/);
  assert.doesNotMatch(brand![0], /MARKET PULSE \/ HK/);
});
