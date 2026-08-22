import type { ChangeRequest, PolicyDecision } from "@qoder-live-lab/contracts";
import { loadConfig } from "./config";
import { ControlClient } from "./control-client";
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
  try {
    await control.event(request.id, "status", `${provider === "qca" ? "Qoder Cloud" : "Local fallback"} agent assigned`, { status: "coding" });
    if (provider === "qca") {
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
    const merge = await mergePullRequest(pullRequest?.number, candidate, request.id, config);
    const released = await control.finish(request.id, "live", { branch, commitSha: candidate.commitSha, files: candidate.files, policy: candidate.policy, testSummary: candidate.testSummary, previewUrl, pullRequestUrl: pullRequest?.html_url });
    await createReleaseTag(released.releaseVersion, merge?.sha, config).catch((error) => control.event(request.id, "release", `Release tag warning · ${error instanceof Error ? error.message : String(error)}`));
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

function guardDeadline(deadline: number) { if (Date.now() >= deadline) throw new Error("Task exceeded the total release budget"); }
function failurePolicy(error: unknown): PolicyDecision {
  const message = error instanceof Error ? error.message : String(error);
  if (/Vercel|Preview|health check/i.test(message)) return { outcome: "reject", layer: "deployment", ruleId: "DEPLOYMENT-FAILED", publicReason: "The candidate Preview could not be verified, so the live version was not changed.", evidence: [safeEvidence(message)] };
  if (/GitHub (?:checks?|merge)|verification checks?|required (?:status )?check/i.test(message)) return { outcome: "reject", layer: "ci", ruleId: "CI-FAILED", publicReason: "Independent CI did not approve the candidate, so the live version was not changed.", evidence: [safeEvidence(message)] };
  const blocked = /policy|protected|not allowed|declined/i.test(message);
  return { outcome: blocked ? "block" : "reject", layer: blocked ? "agent" : "agent", ruleId: blocked ? "AGENT-DECLINED" : "AGENT-FAILED", publicReason: blocked ? "Qoder declined an out-of-bound requirement before promotion." : "The candidate could not be verified inside the release budget.", evidence: [safeEvidence(message)] };
}
function safeEvidence(message: string) { return message.replace(/(?:gh[pousr]_|sk-|Bearer\s+)[A-Za-z0-9_.-]+/gi, "[REDACTED]").slice(0, 140); }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
