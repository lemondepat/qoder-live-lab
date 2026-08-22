import type { PolicyDecision } from "@qoder-live-lab/contracts";

export type RunnerPhase = "agent" | "changeset" | "ci" | "deployment";

export function failurePolicy(error: unknown, phase: RunnerPhase = "agent"): PolicyDecision {
  const message = error instanceof Error ? error.message : String(error);
  if (/Vercel|Preview|health check/i.test(message)) {
    return {
      outcome: "reject",
      layer: "deployment",
      ruleId: "DEPLOYMENT-FAILED",
      publicReason: "The candidate Preview could not be verified, so the live version was not changed.",
      evidence: [safeEvidence(message)],
    };
  }
  if (/GitHub (?:checks?|merge)|verification checks?|required (?:status )?check/i.test(message)) {
    return {
      outcome: "reject",
      layer: "ci",
      ruleId: "CI-FAILED",
      publicReason: "Independent CI did not approve the candidate, so the live version was not changed.",
      evidence: [safeEvidence(message)],
    };
  }
  if (phase === "deployment") {
    return {
      outcome: "reject",
      layer: "deployment",
      ruleId: "DEPLOYMENT-FAILED",
      publicReason: "The candidate Preview could not be verified, so the live version was not changed.",
      evidence: [safeEvidence(message)],
    };
  }
  if (phase === "ci") {
    return {
      outcome: "reject",
      layer: "ci",
      ruleId: "CI-FAILED",
      publicReason: "Independent CI did not approve the candidate, so the live version was not changed.",
      evidence: [safeEvidence(message)],
    };
  }
  const blocked = /policy|protected|not allowed|declined/i.test(message);
  return {
    outcome: blocked ? "block" : "reject",
    layer: "agent",
    ruleId: blocked ? "AGENT-DECLINED" : "AGENT-FAILED",
    publicReason: blocked
      ? "Qoder declined an out-of-bound requirement before promotion."
      : "The candidate could not be verified inside the release budget.",
    evidence: [safeEvidence(message)],
  };
}

function safeEvidence(message: string) {
  return message.replace(/(?:gh[pousr]_|sk-|Bearer\s+)[A-Za-z0-9_.-]+/gi, "[REDACTED]").slice(0, 140);
}
