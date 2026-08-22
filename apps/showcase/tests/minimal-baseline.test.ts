import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const showcase = read("../src/Showcase.tsx");
const richShowcase = read("../src/RichShowcase.tsx");
const css = read("../src/minimal-showcase.css");

test("the active baseline renders only HSI and its trusted current value", () => {
  assert.match(showcase, /<span>HSI<\/span>/);
  assert.match(showcase, /const currentValue = market\.source === "longbridge" && hsi \? hsi\.value : "—"/);
  assert.match(showcase, /<strong aria-live="polite">\{currentValue\}<\/strong>/);
  assert.doesNotMatch(showcase, /SectorHeatmapBoard|VolatilityWeatherMap|IntradayPanel|ThemeToggle|MARKET PULSE|WATCHLIST/);
});

test("the baseline is pure white and black while the rich dashboard stays archived", () => {
  assert.match(css, /background:\s*#fff/);
  assert.match(css, /color:\s*#000/);
  assert.match(richShowcase, /export function RichShowcase/);
  assert.match(richShowcase, /SectorHeatmapBoard|VolatilityWeatherMap|IntradayPanel|ThemeToggle/);
});
