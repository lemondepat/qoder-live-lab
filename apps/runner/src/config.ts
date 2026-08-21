import { resolve } from "node:path";

export type RunnerConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const root = resolve(process.cwd(), process.env.REPOSITORY_PATH || "../..");
  return {
    controlUrl: process.env.CONTROL_BASE_URL || "http://localhost:3000",
    runnerToken: process.env.RUNNER_TOKEN || "dev-runner-token",
    repositoryPath: root,
    provider: process.env.RUNNER_PROVIDER || "qca",
    dryRun: process.env.DRY_RUN === "true" || !process.env.QODER_PAT,
    qoderApiBase: process.env.QODER_API_BASE || "https://api.qoder.com/api/v1/cloud",
    qoderPat: process.env.QODER_PAT,
    qoderAgentId: process.env.QODER_CLOUD_AGENT_ID,
    qoderEnvironmentId: process.env.QODER_CLOUD_ENVIRONMENT_ID,
    githubRepositoryUrl: process.env.GITHUB_REPOSITORY_URL,
    qoderGithubToken: process.env.QODER_GITHUB_TOKEN,
    githubToken: process.env.GITHUB_TOKEN,
    githubDefaultBranch: process.env.GITHUB_DEFAULT_BRANCH || "main",
    vercelToken: process.env.VERCEL_TOKEN,
    vercelProjectId: process.env.VERCEL_SHOWCASE_PROJECT_ID,
    showcaseUrl: process.env.SHOWCASE_BASE_URL || process.env.NEXT_PUBLIC_SHOWCASE_URL || `${process.env.CONTROL_BASE_URL || "http://localhost:3000"}/showcase`,
    taskTimeoutMs: Number(process.env.AGENT_TIMEOUT_MS || 180_000),
    totalTimeoutMs: Number(process.env.TASK_TIMEOUT_MS || 300_000),
    pollMs: Number(process.env.RUNNER_POLL_MS || 2_000),
  };
}

export function assertQcaConfig(config: RunnerConfig) {
  const missing = [
    ["QODER_PAT", config.qoderPat],
    ["QODER_CLOUD_AGENT_ID", config.qoderAgentId],
    ["QODER_CLOUD_ENVIRONMENT_ID", config.qoderEnvironmentId],
    ["GITHUB_REPOSITORY_URL", config.githubRepositoryUrl],
    ["QODER_GITHUB_TOKEN", config.qoderGithubToken],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`QCA configuration missing: ${missing.join(", ")}`);
}
