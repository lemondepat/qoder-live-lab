import type { ChangeRequest } from "@qoder-live-lab/contracts";
import { REHEARSAL_FEATURES, type RehearsalFeature } from "@qoder-live-lab/contracts/features";
import type { RunnerConfig } from "./config";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function resolveFeaturePack(featureId: string | undefined): RehearsalFeature {
  const feature = REHEARSAL_FEATURES.find((item) => item.id === featureId);
  if (!feature) throw new Error("Unknown or unsigned Feature Pack");
  return feature;
}

export function featurePackSource(featureId: string, activationId: string) {
  const editions = ["baseline", ...REHEARSAL_FEATURES.map((feature) => feature.id)];
  if (!editions.includes(featureId)) throw new Error("Unknown Feature Pack edition");
  if (!/^(?:QLL-[A-Z0-9]+|OWNER-BASELINE)$/.test(activationId)) throw new Error("Invalid Feature Pack activation identity");
  const editionLines = editions.map((edition) => `  ${JSON.stringify(edition)},`).join("\n");
  return `export const FEATURE_EDITIONS = [
${editionLines}
] as const;

export type FeatureEdition = (typeof FEATURE_EDITIONS)[number];

// Signed Feature Pack releases change only these two constants. All feature
// code is reviewed and verified on main before the operator can activate it.
export const DEFAULT_FEATURE_EDITION: FeatureEdition = ${JSON.stringify(featureId)};
export const FEATURE_PACK_ACTIVATION = ${JSON.stringify(activationId)};

export function isFeatureEdition(value: string | null): value is FeatureEdition {
  return Boolean(value && FEATURE_EDITIONS.includes(value as FeatureEdition));
}
`;
}

export async function materializeFeaturePack(
  request: ChangeRequest,
  branch: string,
  config: RunnerConfig,
  fetchImpl: FetchLike = fetch,
) {
  const feature = resolveFeaturePack(request.presetFeatureId);
  if (config.dryRun) return { feature, commitSha: "dry-run-feature-pack" };
  if (!config.githubRepositoryUrl || !config.githubToken) throw new Error("Signed Feature Pack requires trusted GitHub controller credentials");
  if (!/^qll\/task-qll-[a-z0-9]+$/.test(branch)) throw new Error("Invalid Feature Pack branch");

  const repository = parseRepository(config.githubRepositoryUrl);
  const base = await githubJson<{ object: { sha: string } }>(fetchImpl, config, repository, `/git/ref/heads/${config.githubDefaultBranch}`);
  const baseCommit = await githubJson<{ tree: { sha: string } }>(fetchImpl, config, repository, `/git/commits/${base.object.sha}`);
  const blob = await githubJson<{ sha: string }>(fetchImpl, config, repository, "/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content: featurePackSource(feature.id, request.id), encoding: "utf-8" }),
  });
  const tree = await githubJson<{ sha: string }>(fetchImpl, config, repository, "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [{ path: "apps/showcase/src/feature-pack.ts", mode: "100644", type: "blob", sha: blob.sha }],
    }),
  });
  const commit = await githubJson<{ sha: string }>(fetchImpl, config, repository, "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: `feat(showcase): activate ${feature.title} · ${request.id}`,
      tree: tree.sha,
      parents: [base.object.sha],
    }),
  });
  await githubJson(fetchImpl, config, repository, "/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });
  return { feature, commitSha: commit.sha };
}

async function githubJson<T = unknown>(
  fetchImpl: FetchLike,
  config: RunnerConfig,
  repository: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${config.githubToken}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub Feature Pack materialization failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

function parseRepository(value: string) {
  const match = value.replace(/\.git$/, "").match(/github\.com[/:]([^/]+\/[^/]+)$/);
  if (!match) throw new Error("GITHUB_REPOSITORY_URL must point to github.com/owner/repository");
  return match[1];
}
