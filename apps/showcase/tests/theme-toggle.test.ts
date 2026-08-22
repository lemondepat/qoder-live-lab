import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const showcase = readFileSync(fileURLToPath(new URL("../src/RichShowcase.tsx", import.meta.url)), "utf8");
const css = readFileSync(fileURLToPath(new URL("../src/showcase.css", import.meta.url)), "utf8");

test("header renders the dark/light toggle after the feed state", () => {
  const header = showcase.match(/<header className="market-header">[\s\S]*?<\/header>/);
  assert.ok(header, "market-header should exist");
  assert.match(header![0], /<ThemeToggle theme=\{theme\} onTheme=\{setTheme\} \/>/);
  assert.ok(header![0].indexOf("feed-state") < header![0].indexOf("ThemeToggle"));
});

test("toggle flips the theme and exposes accessible pressed state", () => {
  assert.match(showcase, /aria-pressed=\{light\}/);
  assert.match(showcase, /onTheme\(light \? "dark" : "light"\)/);
  assert.match(showcase, /document\.documentElement\.dataset\.theme = theme/);
});

test("light theme tokens and toggle styles exist", () => {
  assert.match(css, /:root\[data-theme="light"\] \{[^}]*color-scheme:light/);
  assert.match(css, /\.theme-toggle \{/);
  assert.match(css, /\.theme-toggle\[aria-pressed="true"\] i::after/);
});

test("theme switch does not touch market facts or the disclaimer", () => {
  assert.match(showcase, /const market = useMarketFeed\(\);/);
  assert.match(showcase, /DISPLAY ONLY · NOT INVESTMENT ADVICE/);
});
