# Dormant Feature Library

This repository contains five prebuilt visual accelerators under `apps/showcase/src/feature-library/`. They are deliberately **dormant**: the opening `Showcase.tsx`, Stage, Canvas, Runner, and Ops do not import, select, or activate them. A visitor ticket can only make one visible through a normal Qoder candidate diff that integrates and adapts the relevant source component, then passes policy, tests, CI, Preview, and release checks.

The visitor requirement remains authoritative within the boundaries in `AGENTS.md`. These are starting points, not fixed editions and not hidden deployment switches.

## Semantic matches

| Audience intent | Accelerator source | Export | Trusted props |
|---|---|---|---|
| sectors, heatmap, market leadership, large tiles, winners and losers | `apps/showcase/src/feature-library/sector-heatmap.tsx` | `SectorHeatmapFeature` | `quotes: MarketQuote[]` |
| momentum, trails, ranking, session movement, analytical cockpit | `apps/showcase/src/feature-library/momentum-lens.tsx` | `MomentumLensFeature` | `quotes: MarketQuote[]` |
| command center, broadcast wall, activity tape, breadth, telemetry | `apps/showcase/src/feature-library/market-command.tsx` | `MarketCommandFeature` | `quotes: MarketQuote[]` |
| volatility, dispersion, weather, storm, ambient reactive motion | `apps/showcase/src/feature-library/volatility-storm.tsx` | `VolatilityStormFeature` | `quotes: MarketQuote[]` |
| closing bell, countdown, finale, leader/laggard spotlights, ticker | `apps/showcase/src/feature-library/closing-bell.tsx` | `ClosingBellFeature` | `quotes: MarketQuote[]`, `clock: string`, `session: string` |

Shared visual primitives live in `apps/showcase/src/feature-library/shared.tsx`; accelerator styles live in `apps/showcase/src/feature-library/feature-library.css` and are loaded only when a feature component is imported.

## Required workflow

1. Read the audience ticket, the current `Showcase.tsx`, `showcase.css`, `market-data.ts` types, and `docs/qca/market-data-capabilities.md`.
2. Decide whether the ticket has a strong or partial semantic match to one accelerator above.
3. For a strong match, import the specific component into the candidate and adapt its composition, copy, hierarchy, styling, and supporting code to satisfy the ticket. Do not merely expose the untouched accelerator.
4. For a partial match, reuse only the useful primitives or visual idea and build the rest around the visitor's request.
5. For no match, implement normally without importing this library.
6. Connect the result by editing the ordinary canvas entry point (`Showcase.tsx` or a component it renders). There is no edition query parameter, preset ID, direct Ops activation, or trusted-controller shortcut.
7. Preserve `useMarketFeed()` as the only market-fact source. Derived rankings, breadth, trails, heatmaps, comparisons, and dispersion are allowed. Never introduce literal market facts or simulated ticks.
8. Run the complete candidate verification command before committing and pushing the task branch.

Do not describe private chain-of-thought or a hidden selection score. Public progress may simply say that Qoder inspected the canvas, reused an accelerator, updated candidate files, and verified the result.
