import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const showcase = readFileSync(fileURLToPath(new URL("../src/Showcase.tsx", import.meta.url)), "utf8");
const css = readFileSync(fileURLToPath(new URL("../src/showcase.css", import.meta.url)), "utf8");

test("renders the GAIN/LOSS/FLAT legend on the watchlist header row", () => {
  const row = showcase.match(/<div className="watchlist-row">[\s\S]*?<\/div>/);
  assert.ok(row, "watchlist-row wrapper should exist");
  assert.match(row![0], /WATCHLIST \/ 6/);
  assert.match(row![0], /className="tone-legend"/);
  for (const label of ["GAIN", "LOSS", "FLAT"]) {
    assert.match(row![0], new RegExp(label));
  }
});

test("legend reuses existing CSS variables for gain and loss tones", () => {
  assert.match(css, /\.tone-legend \.gain \{ color:var\(--lime\); \}/);
  assert.match(css, /\.tone-legend \.loss \{ color:var\(--red\); \}/);
});
