import type { ChangeRequest, PolicyDecision } from "@qoder-live-lab/contracts";
import { loadConfig } from "./config";
import { ControlClient } from "./control-client";
import { createPullRequest, findPreview, inspectAndVerify, mergePullRequest, waitForChecks } from "./git-pipeline";
import { runLocal } from "./local-provider";
import { runQca } from "./qca-provider";

const config = loadConfig();
const control = new ControlClient(config);
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

await main();

async function main() {
  process.stdout.write(`Qoder Live Lab runner · ${config.dryRun ? "DRY RUN" : "LIVE"}\n`);
  while (!stopping) {
    try {
      const claimed = await control.claim();
      if (claimed.request) await processRequest(claimed.request, claimed.provider);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
    await sleep(config.pollMs);
  }
}

async function processRequest(request: ChangeRequest, provider: "qca" | "local") {
  const deadline = Date.now() + config.totalTimeoutMs;
  const branch = `qll/task-${request.id.toLowerCase()}`;
  try {
    await control.event(request.id, "status", `${provider === "qca" ? "Qoder Cloud" : "Local fallback"} agent assigned`, { status: "coding" });
    if (provider === "qca") {
      if (config.dryRun) await simulateAgent(request.id);
      else {
        const result = await runQca(request, branch, config, async (progress) => control.event(request.id, progress.kind, progress.message, { providerEventId: progress.providerEventId }));
        await control.event(request.id, "status", "Cloud session completed", { qcaSessionId: result.sessionId });
      }
    } else {
      await runLocal(request, branch, config, (message) => control.event(request.id, "agent", message));
    }
    guardDeadline(deadline);
    await control.event(request.id, "status", "Inspecting the candidate changeset", { status: "testing" });
    const candidate = await inspectAndVerify(branch, config);
    await control.event(request.id, "policy", `${candidate.policy.ruleId} · ${candidate.policy.publicReason}`);
    if (candidate.policy.outcome !== "allow") {
      await control.finish(request.id, "blocked", { branch, commitSha: candidate.commitSha, files: candidate.files, policy: candidate.policy });
      return;
    }
    await control.event(request.id, "test", candidate.testSummary || "Candidate verification passed");
    guardDeadline(deadline);
    await control.event(request.id, "status", "Creating isolated preview", { status: "deploying" });
    const pullRequest = await createPullRequest(candidate, request.id, request.title, config);
    await waitForChecks(candidate, config);
    const previewUrl = await findPreview(candidate, config, request.presetFeatureId);
    guardDeadline(deadline);
    await control.finish(request.id, "live", { branch, commitSha: candidate.commitSha, files: candidate.files, policy: candidate.policy, testSummary: candidate.testSummary, previewUrl, pullRequestUrl: pullRequest?.html_url });
    await mergePullRequest(pullRequest?.number, candidate, request.id, config);
  } catch (error) {
    const policy = failurePolicy(error);
    await control.event(request.id, policy.layer === "agent" ? "agent" : "policy", `${policy.ruleId} · ${policy.publicReason}`).catch(() => undefined);
    await control.finish(request.id, policy.outcome === "block" ? "blocked" : "failed", { branch, policy }).catch(() => undefined);
  }
}

async function simulateAgent(requestId: string) {
  for (const message of ["Cloud sandbox ready", "Inspecting the market canvas", "Updating candidate files", "Running the showcase build"]) {
    await control.event(requestId, "agent", message);
    await sleep(650);
  }
}

function guardDeadline(deadline: number) { if (Date.now() >= deadline) throw new Error("Task exceeded the five-minute release budget"); }
function failurePolicy(error: unknown): PolicyDecision {
  const message = error instanceof Error ? error.message : String(error);
  const blocked = /policy|protected|not allowed|declined/i.test(message);
  return { outcome: blocked ? "block" : "reject", layer: blocked ? "changeset" : "agent", ruleId: blocked ? "POLICY-STOP" : "AGENT-FAILED", publicReason: blocked ? "The candidate was stopped by an enforced boundary." : "The candidate could not be verified inside the release budget.", evidence: [message.replace(/(?:gh[pousr]_|sk-|Bearer\s+)[A-Za-z0-9_.-]+/gi, "[REDACTED]").slice(0, 140)] };
}
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
