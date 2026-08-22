import type { ChangeRequest } from "@qoder-live-lab/contracts";
import { loadConfig } from "./config";
import { ControlClient } from "./control-client";
import { failurePolicy, type RunnerPhase } from "./failure-policy";
import { materializeFeaturePack } from "./feature-pack";
import { createPullRequest, createReleaseTag, findPreview, inspectAndVerify, mergePullRequest, waitForChecks } from "./git-pipeline";
import { runLocal } from "./local-provider";
import { startMarketFeed } from "./market-feed";
import { runQca } from "./qca-provider";

const config = loadConfig();
const control = new ControlClient(config);
let stopping = false;
const marketFeed = startMarketFeed(config, (snapshot) => control.market(snapshot));

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

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

function stop() {
  stopping = true;
  marketFeed.stop();
}

async function processRequest(request: ChangeRequest, provider: "qca" | "local") {
  const deadline = Date.now() + config.totalTimeoutMs;
  const branch = `qll/task-${request.id.toLowerCase()}`;
  let phase: RunnerPhase = "agent";
  try {
    if (request.presetFeatureId) {
      await control.event(request.id, "status", "Signed Feature Pack assigned to the trusted controller", { status: "coding", branch });
      const activation = await materializeFeaturePack(request, branch, config);
      await control.event(request.id, "agent", `Pre-verified pack materialized · ${activation.feature.title}`, { branch, commitSha: activation.commitSha });
    } else if (provider === "qca") {
      await control.event(request.id, "status", "Qoder Cloud agent assigned", { status: "coding", branch });
      if (config.dryRun) await simulateAgent(request.id);
      else {
        const result = await runQca(
          request,
          branch,
          config,
          async (progress) => control.event(request.id, progress.kind, progress.message, { providerEventId: progress.providerEventId }),
          async (sessionId) => control.event(request.id, "status", "Cloud session identity persisted", { qcaSessionId: sessionId }),
          async () => control.event(request.id, "status", "Requirement delivered to Qoder Cloud", { qcaPromptSentAt: new Date().toISOString() }),
        );
        await control.event(request.id, "status", "Cloud session completed", { qcaSessionId: result.sessionId });
      }
    } else {
      await control.event(request.id, "status", "Local fallback agent assigned", { status: "coding", branch });
      await runLocal(request, branch, config, (message) => control.event(request.id, "agent", message));
    }
    phase = "changeset";
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
    phase = "ci";
    await control.event(request.id, "status", "Waiting for independent checks", { status: "testing" });
    const pullRequest = await createPullRequest(candidate, request.id, request.title, config);
    await waitForChecks(candidate, config);
    guardDeadline(deadline);
    phase = "deployment";
    await control.event(request.id, "status", "Creating isolated preview", { status: "deploying" });
    const previewUrl = await findPreview(candidate, config, request.presetFeatureId);
    guardDeadline(deadline);
    const merge = await mergePullRequest(pullRequest?.number, candidate, request.id, config);
    const released = await control.finish(request.id, "live", { branch, commitSha: candidate.commitSha, files: candidate.files, policy: candidate.policy, testSummary: candidate.testSummary, previewUrl, pullRequestUrl: pullRequest?.html_url });
    await createReleaseTag(released.releaseVersion, merge?.sha, config).catch((error) => control.event(request.id, "release", `Release tag warning · ${error instanceof Error ? error.message : String(error)}`));
  } catch (error) {
    const policy = failurePolicy(error, phase);
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

function guardDeadline(deadline: number) { if (Date.now() >= deadline) throw new Error("Task exceeded the total release budget"); }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
