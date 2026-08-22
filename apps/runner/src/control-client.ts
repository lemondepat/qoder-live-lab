import type { ChangeRequest, MarketIntradaySnapshot, MarketSnapshot, PolicyDecision } from "@qoder-live-lab/contracts";
import type { RunnerConfig } from "./config";

export class ControlClient {
  constructor(private config: RunnerConfig) {}

  async claim(): Promise<{ request?: ChangeRequest; provider: "qca" | "local" }> {
    return this.post("/api/runner/claim", {});
  }

  async heartbeat() { await this.post("/api/runner/heartbeat", {}); }

  async market(snapshot: MarketSnapshot) { await this.post("/api/runner/market", snapshot); }

  async marketIntraday(snapshots: MarketIntradaySnapshot[]) { await this.post("/api/runner/market/intraday", { snapshots }); }

  async marketDemand(): Promise<{ symbols: string[] }> { return this.post("/api/runner/market/demand", {}); }

  async event(requestId: string, kind: "status" | "agent" | "test" | "policy" | "release", message: string, extra: Record<string, unknown> = {}) {
    await this.post("/api/runner/event", { requestId, kind, message: sanitize(message), ...extra });
  }

  async finish(requestId: string, status: "live" | "blocked" | "failed" | "cancelled", patch: { previewUrl?: string; commitSha?: string; branch?: string; pullRequestUrl?: string; testSummary?: string; files?: string[]; policy?: PolicyDecision } = {}) {
    return this.post("/api/runner/finish", { requestId, status, ...patch }) as Promise<ChangeRequest>;
  }

  private async post(path: string, body: unknown) {
    const response = await fetch(`${this.config.controlUrl}${path}`, { method: "POST", headers: { authorization: `Bearer ${this.config.runnerToken}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Control API ${path} returned ${response.status}: ${await response.text()}`);
    return response.json();
  }
}

function sanitize(value: string) {
  return value.replace(/(?:gh[pousr]_|sk-|Bearer\s+)[A-Za-z0-9_.-]+/gi, "[REDACTED]").replace(/\/?Users\/[^/\s]+/g, "/Users/[REDACTED]").replace(/\s+/g, " ").slice(0, 220);
}
