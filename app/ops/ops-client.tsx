"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BoardSnapshot, MarketSnapshot } from "@qoder-live-lab/contracts";
import { GUARDRAIL_CHALLENGES } from "@qoder-live-lab/contracts/policy";
import { REHEARSAL_FEATURES } from "@qoder-live-lab/contracts/features";

export function OpsClient() {
  const [passcode, setPasscode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [board, setBoard] = useState<BoardSnapshot>();
  const [market, setMarket] = useState<MarketSnapshot>();
  const [message, setMessage] = useState("Sign in to enable operator controls.");

  async function refresh() {
    const [nextBoard, nextMarket] = await Promise.all([
      fetch("/api/board", { cache: "no-store" }).then((response) => response.json()) as Promise<BoardSnapshot>,
      fetch("/api/market", { cache: "no-store" }).then((response) => response.json()) as Promise<MarketSnapshot>,
    ]);
    setBoard(nextBoard);
    setMarket(nextMarket);
  }

  useEffect(() => { const kickoff = window.setTimeout(() => refresh().catch(() => undefined), 0); const timer = window.setInterval(() => refresh().catch(() => undefined), 2000); return () => { window.clearTimeout(kickoff); window.clearInterval(timer); }; }, []);

  async function login() {
    const response = await fetch("/api/ops/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode }) });
    setAuthenticated(response.ok);
    setMessage(response.ok ? "Operator controls unlocked." : "Incorrect passcode.");
  }

  async function act(action: string, challenge?: string, featureId?: string) {
    const response = await fetch("/api/ops/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, challenge, featureId }) });
    if (response.status === 401) { setAuthenticated(false); setMessage("Operator session expired."); return; }
    const next = await response.json() as BoardSnapshot;
    setBoard(next);
    setMessage(`Action complete: ${action}`);
  }

  const active = board?.requests.find((item) => item.id === board.system.activeRequestId);
  const runnerOnline = Boolean(board?.system.runnerLastSeenAt && new Date(board.generatedAt).getTime() - new Date(board.system.runnerLastSeenAt).getTime() < 15_000);
  return (
    <main className="ops-shell">
      <header className="ops-header"><Link href="/">← Public board</Link><div><span>Q</span><b>Qoder Live Lab / Ops</b></div><Link href="/stage">Open stage ↗</Link></header>
      <section className="ops-hero"><div><p>TRUSTED CONTROL PLANE</p><h1>Run fast.<br /><em>Stay bounded.</em></h1></div><div className="ops-status"><span>RUNNER</span><b className={runnerOnline ? "ok" : ""}>{runnerOnline ? "CONNECTED" : "WAITING"}</b><small>{board?.system.provider.toUpperCase() ?? "QCA"} provider · {board?.system.queuePaused ? "Queue paused" : "Auto mode"}</small></div></section>
      <section className="ops-grid">
        <article className="ops-card wide"><span className="ops-label">CURRENT JOB</span><h2>{active?.title ?? "No active task"}</h2><p>{active ? `${active.id} · ${active.status.toUpperCase()}` : "The runner will claim the next allowed request automatically."}</p>{active?.events.slice(-4).map((event) => <div className="ops-log" key={event.id}><time>{new Date(event.createdAt).toLocaleTimeString()}</time><span>{event.message}</span></div>)}</article>
        <article className="ops-card"><span className="ops-label">MARKET DATA</span><h2>{market?.status.toUpperCase() ?? "CONNECTING"}</h2><p>{market ? `${market.providerLabel} · ${market.session.toUpperCase()} · sequence ${market.sequence}` : "Waiting for the trusted quote sidecar."}</p><div className="ops-log"><time>LAST TICK</time><span>{market ? new Date(market.marketTimestamp).toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong", hour12: false }) : "—"}</span></div></article>
        <article className="ops-card"><span className="ops-label">OPERATOR ACCESS</span><input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder="Passcode" aria-label="Operator passcode" /><button onClick={login}>Unlock controls</button><p>{message}</p></article>
        <article className="ops-card"><span className="ops-label">QUEUE CONTROL</span><div className="ops-actions"><button disabled={!authenticated} onClick={() => act(board?.system.queuePaused ? "resume" : "pause")}>{board?.system.queuePaused ? "Resume queue" : "Pause queue"}</button><button disabled={!authenticated || !active} onClick={() => act("cancel")}>Cancel active</button><button disabled={!authenticated || !board?.system.previousRelease} onClick={() => act("rollback")}>Rollback release</button><button disabled={!authenticated || board?.system.activeRelease.version === "v0.4"} onClick={() => act("opening-baseline")}>Reset opening baseline</button></div></article>
        <article className="ops-card"><span className="ops-label">EXECUTION PROVIDER</span><div className="provider-switch"><button disabled={!authenticated} className={board?.system.provider === "qca" ? "selected" : ""} onClick={() => act("provider-qca")}>Qoder Cloud</button><button disabled={!authenticated} className={board?.system.provider === "local" ? "selected" : ""} onClick={() => act("provider-local")}>Local fallback</button></div><p>The stage always names the provider honestly.</p></article>
        <article className="ops-card wide"><span className="ops-label">FEATURE LAUNCHPAD</span><h2>Cue a high-impact rehearsal feature.</h2><p>Each signed feature enters the normal queue. In live mode QCA implements the request; in labelled rehearsal mode the controller can use the pre-verified visual edition.</p><div className="feature-grid">{REHEARSAL_FEATURES.map((feature, index) => <button key={feature.id} disabled={!authenticated} onClick={() => act("feature", undefined, feature.id)} style={{ "--feature-accent": feature.accent } as React.CSSProperties}><span>0{index + 1} · SIGNED FEATURE</span><strong>{feature.title}</strong><small>{feature.impact}</small><i>QUEUE ↗</i></button>)}</div></article>
        <article className="ops-card wide"><span className="ops-label">BOUNDARY CHALLENGE</span><h2>Prove the guardrails are real.</h2><div className="challenge-grid">{GUARDRAIL_CHALLENGES.map((challenge) => <button key={challenge} disabled={!authenticated} onClick={() => act("challenge", challenge)}><span>RUN IN SANDBOX</span>{challenge}</button>)}</div></article>
      </section>
    </main>
  );
}
