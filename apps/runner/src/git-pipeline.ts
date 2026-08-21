import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { evaluateChanges } from "@qoder-live-lab/contracts/policy";
import type { PolicyDecision } from "@qoder-live-lab/contracts";
import type { RunnerConfig } from "./config";

const exec = promisify(execFile);

export type Candidate = { branch: string; commitSha: string; files: string[]; diff: string; policy: PolicyDecision; testSummary?: string };

export async function inspectAndVerify(branch: string, config: RunnerConfig): Promise<Candidate> {
  if (config.dryRun) {
    const files = ["apps/showcase/src/Showcase.tsx", "apps/showcase/src/showcase.css"];
    return { branch, commitSha: "dry-run-candidate", files, diff: "+ bounded visual change", policy: evaluateChanges(files, "+ bounded visual change"), testSummary: "Dry-run policy and build simulation passed" };
  }
  await git(config.repositoryPath, ["fetch", "origin", `${branch}:${branch}`]);
  const commitSha = (await git(config.repositoryPath, ["rev-parse", branch])).trim();
  const base = `origin/${config.githubDefaultBranch}`;
  const files = splitLines(await git(config.repositoryPath, ["diff", "--name-only", `${base}...${branch}`]));
  const diff = await git(config.repositoryPath, ["diff", "--unified=2", `${base}...${branch}`]);
  const policy = evaluateChanges(files, diff);
  if (policy.outcome !== "allow") return { branch, commitSha, files, diff, policy };

  const worktree = await mkdtemp(join(tmpdir(), "qll-candidate-"));
  try {
    await git(config.repositoryPath, ["worktree", "add", "--detach", worktree, branch]);
    await exec("npm", ["ci", "--ignore-scripts", "--prefer-offline"], { cwd: worktree, timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
    await exec("npm", ["run", "build", "--workspace", "@qoder-live-lab/showcase"], { cwd: worktree, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    return { branch, commitSha, files, diff, policy, testSummary: "Policy passed · Showcase build passed" };
  } finally {
    await git(config.repositoryPath, ["worktree", "remove", "--force", worktree]).catch(() => undefined);
    await rm(worktree, { recursive: true, force: true });
  }
}

export async function createPullRequest(candidate: Candidate, requestId: string, title: string, config: RunnerConfig) {
  if (config.dryRun || !config.githubToken || !config.githubRepositoryUrl) return undefined;
  const repo = parseRepository(config.githubRepositoryUrl);
  const response = await github(config, `/repos/${repo}/pulls`, { method: "POST", body: JSON.stringify({ title: `${requestId}: ${title}`, head: candidate.branch, base: config.githubDefaultBranch, body: `Automated candidate from Qoder Live Lab.\n\nPolicy: ${candidate.policy.ruleId}\nTests: ${candidate.testSummary}` }) });
  if (response.status === 422) {
    const existing = await github(config, `/repos/${repo}/pulls?state=open&head=${repo.split("/")[0]}:${candidate.branch}`);
    const items = await existing.json() as Array<{ number: number; html_url: string }>;
    return items[0];
  }
  if (!response.ok) throw new Error(`GitHub PR creation failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<{ number: number; html_url: string }>;
}

export async function waitForChecks(candidate: Candidate, config: RunnerConfig) {
  if (config.dryRun || !config.githubToken || !config.githubRepositoryUrl) return;
  const repo = parseRepository(config.githubRepositoryUrl);
  const deadline = Date.now() + 75_000;
  let sawChecks = false;
  while (Date.now() < deadline) {
    const response = await github(config, `/repos/${repo}/commits/${candidate.commitSha}/check-runs`);
    if (response.ok) {
      const data = await response.json() as { check_runs: Array<{ status: string; conclusion: string | null }> };
      if (data.check_runs.length) {
        sawChecks = true;
        if (data.check_runs.some((check) => check.status === "completed" && check.conclusion !== "success" && check.conclusion !== "neutral" && check.conclusion !== "skipped")) throw new Error("A required GitHub check failed");
        if (data.check_runs.every((check) => check.status === "completed")) return;
      }
    }
    await sleep(3000);
  }
  if (sawChecks) throw new Error("GitHub checks exceeded the release time budget");
}

export async function findPreview(candidate: Candidate, config: RunnerConfig) {
  if (config.dryRun || !config.vercelToken || !config.vercelProjectId) return `${config.controlUrl}/showcase`;
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("projectId", config.vercelProjectId);
    url.searchParams.set("limit", "10");
    const response = await fetch(url, { headers: { authorization: `Bearer ${config.vercelToken}` } });
    if (response.ok) {
      const data = await response.json() as { deployments: Array<{ url: string; state: string; meta?: Record<string, string> }> };
      const deployment = data.deployments.find((item) => item.meta?.githubCommitSha === candidate.commitSha);
      if (deployment?.state === "ERROR") throw new Error("Vercel preview failed");
      if (deployment?.state === "READY") {
        const preview = `https://${deployment.url}`;
        const health = await fetch(preview, { redirect: "follow" });
        if (!health.ok) throw new Error(`Preview health check failed: ${health.status}`);
        return preview;
      }
    }
    await sleep(3000);
  }
  throw new Error("Vercel preview exceeded the release time budget");
}

export async function mergePullRequest(prNumber: number | undefined, candidate: Candidate, requestId: string, config: RunnerConfig) {
  if (!prNumber || config.dryRun || !config.githubToken || !config.githubRepositoryUrl) return;
  const repo = parseRepository(config.githubRepositoryUrl);
  const response = await github(config, `/repos/${repo}/pulls/${prNumber}/merge`, { method: "PUT", body: JSON.stringify({ commit_title: `${requestId}: verified canvas change`, merge_method: "squash" }) });
  if (!response.ok) throw new Error(`GitHub merge failed: ${response.status} ${await response.text()}`);
}

async function git(cwd: string, args: string[]) {
  const { stdout } = await exec("git", args, { cwd, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

function splitLines(value: string) { return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function parseRepository(value: string) {
  const match = value.replace(/\.git$/, "").match(/github\.com[/:]([^/]+\/[^/]+)$/);
  if (!match) throw new Error("GITHUB_REPOSITORY_URL must point to github.com/owner/repository");
  return match[1];
}
function github(config: RunnerConfig, path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com${path}`, { ...init, headers: { authorization: `Bearer ${config.githubToken}`, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28", ...init.headers } });
}
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
