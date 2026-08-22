# Qoder Live Lab

An event-ready live development lab for Qoder Cloud Agents. Visitors submit an ambitious but bounded transformation to an intentionally sparse Hong Kong market dashboard, watch it move across a public board, and see a verified release appear on the stage display. A trusted Longbridge feed supplies real Hong Kong market facts; unsafe requests and out-of-scope changes are visibly blocked while the current release stays live.

Live: [Public board](https://qoder-live-lab.vercel.app) · [Release history](https://qoder-live-lab.vercel.app/releases) · [Stage display](https://qoder-live-lab.vercel.app/stage) · [Market canvas](https://qoder-live-lab-canvas.vercel.app)

## What the audience sees

```text
phone request → QUEUED → CODING → TESTING → DEPLOYING → LIVE
                                  ↘ BLOCKED → 0 files promoted

                                      trusted release controller
Qoder candidate branch → diff policy → tests → Preview → active release
```

- `/` — public request form, mobile Kanban, and a read-only codebase guide
- `/releases` — version-by-version release history with change and verification evidence
- `/stage` — fullscreen stable canvas with release and block notifications
- `/showcase` — local fallback for the intentionally simple Hong Kong market dashboard
- `/ops` — protected operator controls, rollback, execution-boundary challenges, and rehearsal feature launchpad

Qoder only creates a candidate branch. It cannot activate a release. The runner is the sole component allowed to promote a candidate after independent policy, test, CI, and Preview checks.

## Repository shape

- `app/` — Next.js control plane, board, stage, ops, and API routes
- `apps/showcase/` — independently deployable Vite + React market canvas; the only product area Qoder may edit
- `apps/runner/` — trusted local scheduler and release controller
- `packages/contracts/` — shared states, API contracts, and policy rules
- `tests/` — policy, state, SSE, deduplication, and rendered-route tests

Candidate changes are limited to `apps/showcase/src/**`, `apps/showcase/tests/**`, and `apps/showcase/public/**`. Inside that presentation surface, Qoder may replace the full layout, component structure, charts, motion, visual system, filters, and responsive behavior. The trusted market feed, displayed facts, feed status, display-only disclaimer, and any trading action remain protected. The complete agent boundary is in `AGENTS.md`.

## Connect the live Hong Kong market feed

Computer B owns a read-only market-data sidecar. It starts one long-lived Longbridge OpenAPI session, subscribes to the three Hang Seng indices and six watchlist equities, folds quote ticks into a sanitized snapshot, and posts that snapshot to the control plane. Neon stores only public market facts; Longbridge tokens never enter Vercel, the browser, Qoder, or the repository.

Install and authorize the official Longbridge CLI on computer B:

```bash
brew install --cask longbridge/tap/longbridge-terminal
longbridge auth login
longbridge auth status
```

Set `MARKET_FEED_PROVIDER=longbridge` and the absolute `LONGBRIDGE_BINARY` path in the runner environment. `/api/market` exposes only the validated public snapshot. The Canvas polls this endpoint every two seconds and shows `LIVE`, `STALE`, `DELAYED`, or `DEMO` explicitly. A disconnected feed preserves the last good tick and never invents replacement values.

## Run locally

Requirements: Node.js 22+ and npm 10+.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. In another terminal, start the trusted runner:

```bash
npm run runner
```

The example environment starts in `DRY_RUN=true`. This exercises queueing, policy, build, evidence, and release-state transitions without calling Qoder or publishing a real branch. The development-only Ops passcode defaults to `qoder-live`; set a strong `OPS_PASSCODE` and `OPS_SESSION_SECRET` everywhere else.

## Connect Qoder Cloud Agents

1. Create a Qoder PAT, Cloud Agent, and restricted Cloud Environment.
2. Give Qoder a repository-scoped token with only Contents read/write, used solely to push task branches. Do not grant it Pull requests, Actions, status, deployment, or administration permissions.
3. Configure the environment with fixed dependencies and only read/glob/grep/edit/write/bash tools.
4. Set `QODER_PAT`, `QODER_CLOUD_AGENT_ID`, `QODER_CLOUD_ENVIRONMENT_ID`, and `DRY_RUN=false` on computer B.
5. Validate the connection before rehearsal:

```bash
npm run qca:doctor
```

The provider opens the SSE stream before sending work, stores every Qoder event ID, resumes with `Last-Event-ID`, and publishes only readable progress. Agent thinking and raw credentials are never sent to the public board.

## GitHub and release setup

- Protect `main`: require pull requests and the `verify` check, enforce the rule for administrators, and prohibit force-pushes and deletion.
- Give the trusted runner a separate fine-grained GitHub token scoped to this repository for PR, CI, merge, and release operations. Never mount that token into Qoder.
- Deploy the root as the control project and `apps/showcase` as the canvas project on Vercel.
- Set `NEXT_PUBLIC_SHOWCASE_URL` on the control project to the current immutable canvas release.
- Set `VERCEL_TOKEN` and `VERCEL_SHOWCASE_PROJECT_ID` only on computer B, never in Qoder's environment.
- Attach Neon Postgres to the control project and set `DATABASE_URL`. Without it, local development uses an in-memory seeded board.

The runner creates `qll/task-<id>`, enforces the diff policy, builds in an isolated worktree, opens a PR, waits for required checks and a Vercel Preview, then updates the active release and merges. Failures remove promotion eligibility and leave the previous version live.

## Enforced boundaries

| Rule | Enforcement |
| --- | --- |
| `SCOPE-001` | blocks control, runner, contracts, ops, and other non-canvas paths |
| `DEPS-001` | blocks package manifests and lockfiles |
| `TESTS-001` | blocks deleted, skipped, or weakened tests |
| `SECRETS-001` | blocks environment and credential access or output |
| `NETWORK-001` | blocks remote scripts, external requests, iframes, and trackers |
| `PIPELINE-001` | blocks CI, hosting, Qoder, and security configuration |
| `GIT-001` | prevents direct or forced pushes to `main` |
| `UI-001` | blocks navigation, popups, payments, login, and data collection |
| `DATA-001` | protects trusted quotes and displayed market facts |
| `FINANCE-001` | blocks order execution, trading controls, and disclaimer removal |

The public input gate rejects obvious violations immediately. The Qoder policy can return `DECLINED`. The independent diff/CI/deployment gates remain authoritative even if a candidate agent attempts a forbidden change.

## Rehearsal

Run the full local verification:

```bash
npm run check
npm run test:render
```

Before doors open:

- Put `/stage` fullscreen on computer A and `/ops` plus runner logs on computer B.
- Start with the deliberately sparse baseline: one index, one plain watchlist, and no advanced visualizations.
- Use the Feature Launchpad to queue a full-screen heatmap, momentum cockpit, market command wall, volatility environment, or closing-bell mode. Live mode still follows the normal Qoder and policy path; dry-run mode is visibly labelled rehearsal fallback.
- Submit one safe visual request and confirm it reaches `LIVE` within the configured 25-minute release budget. The Qoder Cloud Agent may use up to 20 minutes, leaving five minutes for independent checks, Preview, and activation.
- Run “Modify the admin control panel” from Ops and confirm `BLOCKED`, a rule ID, redacted evidence, `0 files promoted`, and an unchanged stage canvas.
- Test pause, cancel, runner restart, Qoder credential failure, and rollback.
- Keep `DRY_RUN=true` as a clearly labelled fallback if Qoder Cloud Agents or venue networking is unavailable.

## Useful commands

```bash
npm run dev                 # control plane
npm run runner              # long-running trusted controller
npm run qca:doctor          # Cloud Agent connectivity check
npm run policy:changeset    # policy check for the current candidate diff
npm run check               # lint, unit tests, and both builds
npm run test:render         # production route smoke tests
```
