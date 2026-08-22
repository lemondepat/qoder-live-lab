import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { REHEARSAL_FEATURES } from "@qoder-live-lab/contracts/features";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the prebuilt feature library is dormant in the opening showcase", async () => {
  const [showcase, main, runner, preview] = await Promise.all([
    read("apps/showcase/src/Showcase.tsx"),
    read("apps/showcase/src/main.tsx"),
    read("apps/runner/src/index.ts"),
    read("apps/runner/src/git-pipeline.ts"),
  ]);

  assert.doesNotMatch(showcase, /feature-library|feature-pack|URLSearchParams|\?edition/);
  assert.doesNotMatch(main, /feature-library|feature-pack/);
  assert.doesNotMatch(runner, /materializeFeaturePack|presetFeatureId/);
  assert.doesNotMatch(preview, /presetFeatureId|searchParams\.set\("edition"/);
  assert.match(showcase, /className="market-shell edition-baseline"/);
});

test("all five dormant accelerators are exported and documented for semantic matching", async () => {
  const [index, catalog] = await Promise.all([
    read("apps/showcase/src/feature-library/index.ts"),
    read("docs/qca/feature-library.md"),
  ]);
  const expected = [
    ["sector-heatmap", "SectorHeatmapFeature", "sector-heatmap.tsx"],
    ["momentum-lens", "MomentumLensFeature", "momentum-lens.tsx"],
    ["market-command", "MarketCommandFeature", "market-command.tsx"],
    ["volatility-storm", "VolatilityStormFeature", "volatility-storm.tsx"],
    ["closing-bell", "ClosingBellFeature", "closing-bell.tsx"],
  ] as const;

  assert.equal(REHEARSAL_FEATURES.length, expected.length);
  for (const [id, exportName, file] of expected) {
    assert.ok(REHEARSAL_FEATURES.some((feature) => feature.id === id));
    assert.match(index, new RegExp(exportName));
    assert.match(catalog, new RegExp(file.replace(".", "\\.")));
  }
  assert.match(catalog, /strong or partial semantic match/i);
  assert.match(catalog, /There is no edition query parameter, preset ID, direct Ops activation/);
});

test("Ops displays the library but cannot activate it directly", async () => {
  const [client, route] = await Promise.all([
    read("app/ops/ops-client.tsx"),
    read("app/api/ops/action/route.ts"),
  ]);

  assert.match(client, /DORMANT FEATURE LIBRARY/);
  assert.match(client, /QCA DISCOVERS · NOT CONNECTED/);
  assert.doesNotMatch(client, /act\("feature"/);
  assert.doesNotMatch(route, /createRehearsalFeature|"feature"|featureId/);
});
