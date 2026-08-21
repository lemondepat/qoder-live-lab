"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardSnapshot, ChangeRequest, RequestStatus } from "@qoder-live-lab/contracts";
import { GUARDRAIL_CHALLENGES } from "@qoder-live-lab/contracts/policy";

const fallback: BoardSnapshot = {
  generatedAt: new Date().toISOString(),
  system: { queuePaused: false, provider: "qca", activeRequestId: "QLL-018", runnerLastSeenAt: new Date().toISOString(), activeRelease: { version: "v0.4", requestId: "QLL-016", requirement: "Add a pulse to the center orb", previewUrl: "/showcase", activatedAt: new Date().toISOString(), healthy: true } },
  requests: [
    fallbackCard("QLL-018", "Add a comet trail that follows the cursor", "Mia", "coding"),
    fallbackCard("QLL-017", "Make every click launch a tiny constellation", "Noah", "testing"),
    { ...fallbackCard("QLL-016", "Add a pulse to the center orb", "Lena", "live"), releaseVersion: "v0.4", testSummary: "18 tests passed" },
    { ...fallbackCard("QLL-015", "Modify the admin control panel", "Guardrail demo", "blocked"), policy: { outcome: "block", layer: "changeset", ruleId: "SCOPE-001", publicReason: "The control plane is protected.", evidence: ["Protected path: apps/control/app/page.tsx", "0 files promoted"] } },
  ],
};

const lanes: { key: string; statuses: RequestStatus[]; label: string; eyebrow: string }[] = [
  { key: "queued", statuses: ["queued"], label: "Queue", eyebrow: "Waiting" },
  { key: "coding", statuses: ["coding"], label: "Building", eyebrow: "Qoder Cloud Agent" },
  { key: "testing", statuses: ["testing", "deploying"], label: "Verifying", eyebrow: "Policy + tests" },
  { key: "live", statuses: ["live"], label: "Shipped", eyebrow: "Current release" },
];

export default function Home() {
  const [board, setBoard] = useState(fallback);
  const [author, setAuthor] = useState("Guest");
  const [request, setRequest] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const next = await fetch("/api/board", { cache: "no-store" }).then((response) => response.json()) as BoardSnapshot;
      if (active) setBoard(next);
    };
    const kickoff = window.setTimeout(() => refresh().catch(() => undefined), 0);
    const timer = window.setInterval(() => refresh().catch(() => undefined), 2000);
    return () => { active = false; window.clearTimeout(kickoff); window.clearInterval(timer); };
  }, []);

  const grouped = useMemo(() => Object.fromEntries(lanes.map((lane) => [lane.key, board.requests.filter((card) => lane.statuses.includes(card.status))])), [board]);
  const latestBlocked = board.requests.find((item) => item.status === "blocked" || item.status === "rejected");
  const activeRequest = board.requests.find((item) => item.id === board.system.activeRequestId);

  async function submitRequest(value = request) {
    const clean = value.trim();
    if (clean.length < 20) { setNotice("Add a little more detail — 20 characters minimum."); return; }
    if (author.trim().length < 2) { setNotice("Add a nickname first."); return; }
    setSubmitting(true);
    window.localStorage.setItem("qll-nickname", author.trim());
    const response = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ author: author.trim(), title: clean, idempotencyKey: crypto.randomUUID() }) });
    const created = await response.json() as ChangeRequest & { error?: string };
    setSubmitting(false);
    if (!response.ok) { setNotice(created.error || "The request could not be submitted."); return; }
    setRequest("");
    setNotice(created.status === "rejected" ? `Blocked by ${created.policy?.ruleId}. The live version was not changed.` : "Request added to the live queue.");
    setBoard((current) => ({ ...current, requests: [created, ...current.requests.filter((item) => item.id !== created.id)] }));
  }

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="#top" aria-label="Qoder Live Lab home"><span className="brand-mark">Q</span><span>Qoder Live Lab</span></a><nav className="top-links"><a href="/stage">Stage</a><a href="/ops">Ops</a><div className="live-pill"><span />LIVE · {board.system.activeRelease.version}</div></nav></header>
      <section className="hero" id="top"><div className="hero-copy"><p className="kicker"><span>01</span> Build in public</p><h1>Ask for a change.<br /><em>Watch it ship.</em></h1><p className="lede">Your idea enters a real engineering queue. Qoder codes it, tests it, checks its boundaries, and publishes a working release.</p></div><div className="signal-card" aria-label="Current agent activity"><div className="signal-head"><span>Agent signal</span><span className="signal-dot" /></div><div className="orb"><i /><b>Q</b></div><div className="signal-meta"><strong>{activeRequest ? `Building ${activeRequest.id}` : "Ready for the next idea"}</strong><span>{activeRequest?.events.at(-1)?.message ?? "Guardrails online"}</span></div></div></section>
      <section className="request-panel" aria-labelledby="request-heading"><div><p className="section-index">02 / YOUR TURN</p><h2 id="request-heading">What should the canvas do next?</h2><div className="boundary-prompts"><span>TEST THE GUARDRAILS</span>{GUARDRAIL_CHALLENGES.slice(0, 3).map((challenge) => <button key={challenge} onClick={() => { setRequest(challenge); setNotice("This challenge should be blocked safely."); }}>{challenge}</button>)}</div></div><div className="request-form"><label>YOUR NICKNAME<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={24} /></label><textarea value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Try: Add a field of stars that reacts to sound…" maxLength={200} aria-label="Describe your feature request" /><div className="form-foot"><span>{request.length}/200</span><button disabled={submitting || board.system.queuePaused} onClick={() => submitRequest()}>{board.system.queuePaused ? "Queue paused" : submitting ? "Submitting…" : "Join the queue"} <b>↗</b></button></div>{notice && <p className="notice" role="status">{notice}</p>}</div></section>
      <section className="board" aria-labelledby="board-heading"><div className="board-title"><div><p className="section-index">03 / LIVE PIPELINE</p><h2 id="board-heading">Every change leaves evidence.</h2></div><span>{board.system.provider.toUpperCase()} · Auto-refresh · 2s</span></div><div className="lanes">{lanes.map((lane) => <section className="lane" key={lane.key}><header><div><span className={`lane-dot ${lane.key}`} />{lane.label}</div><small>{lane.eyebrow}</small></header><div className="lane-cards">{(grouped[lane.key] ?? []).map((card: ChangeRequest) => <RequestCard key={card.id} card={card} />)}{(grouped[lane.key] ?? []).length === 0 && <div className="empty-card">{lane.key === "queued" ? "Your idea could be next." : "No changes here right now."}</div>}</div></section>)}</div>{latestBlocked && <div className="blocked-strip"><div className="blocked-icon">×</div><div><span>CHANGE BLOCKED · {latestBlocked.policy?.ruleId ?? "POLICY"}</span><strong>{latestBlocked.policy?.publicReason ?? "Candidate did not pass the guardrails."}</strong><p>0 files promoted · Live version remains {board.system.activeRelease.version}</p></div><button onClick={() => document.getElementById("guardrails")?.scrollIntoView({ behavior: "smooth" })}>View evidence</button></div>}</section>
      <section className="guardrails" id="guardrails"><div><p className="section-index">04 / GUARDRAILS</p><h2>Autonomous.<br />Not unbounded.</h2></div><div className="guardrail-list">{[["SCOPE-001", "The agent may edit the creative canvas — never the control plane."],["TESTS-001", "Tests can be added and strengthened, never removed or skipped."],["SECRETS-001", "Production credentials are never available inside the agent sandbox."],["GIT-001", "Only the trusted runner can merge and activate a release."]].map(([id, copy]) => <div className="guardrail" key={id}><span>{id}</span><p>{copy}</p><b>ENFORCED</b></div>)}</div></section>
      <footer><span>QODER LIVE LAB · 2026</span><span>Cloud agents with visible boundaries.</span></footer>
    </main>
  );
}

function RequestCard({ card }: { card: ChangeRequest }) {
  const tone = card.status === "live" ? "green" : card.status === "testing" || card.status === "deploying" ? "cyan" : card.status === "blocked" || card.status === "rejected" ? "orange" : "purple";
  return <details className={`request-card ${tone}`}><summary><div className="card-top"><span>{card.id}</span><span>{card.status.toUpperCase()}</span></div><h3>{card.title}</h3><p>Requested by {card.author}</p><div className="card-meta"><span>{card.releaseVersion ?? card.testSummary ?? card.events.at(-1)?.message ?? "Awaiting evidence"}</span><b>＋</b></div></summary><div className="card-detail">{card.policy && <div className="policy-evidence"><b>{card.policy.ruleId}</b><p>{card.policy.publicReason}</p>{card.policy.evidence.map((item) => <span key={item}>↳ {item}</span>)}</div>}{card.files?.map((file) => <span key={file}>EDIT · {file}</span>)}{card.events.slice(-4).map((event) => <span key={event.id}>{event.kind.toUpperCase()} · {event.message}</span>)}{card.pullRequestUrl && <a href={card.pullRequestUrl} target="_blank" rel="noreferrer">Open pull request ↗</a>}{card.previewUrl && <a href={card.previewUrl} target="_blank" rel="noreferrer">Open preview ↗</a>}</div></details>;
}

function fallbackCard(id: string, title: string, author: string, status: RequestStatus): ChangeRequest {
  const timestamp = new Date().toISOString();
  return { id, title, author, status, source: status === "blocked" ? "ops" : "public", createdAt: timestamp, updatedAt: timestamp, events: [{ id: `evt-${id}`, requestId: id, kind: "status", message: `Task entered ${status}`, createdAt: timestamp }] };
}
