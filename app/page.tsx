"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  OPENING_RELEASE_REQUEST_ID,
  OPENING_RELEASE_REQUIREMENT,
  OPENING_RELEASE_VERSION,
  type BoardSnapshot,
  type ChangeRequest,
  type RequestEvent,
  type RequestStatus,
} from "@qoder-live-lab/contracts";
import { REHEARSAL_FEATURES } from "@qoder-live-lab/contracts/features";
import { GUARDRAIL_CHALLENGES } from "@qoder-live-lab/contracts/policy";
import { RepoGuide } from "./repo-guide";

const fallback: BoardSnapshot = {
  generatedAt: new Date().toISOString(),
  system: {
    queuePaused: false,
    provider: "qca",
    activeRequestId: "QLL-018",
    runnerLastSeenAt: new Date().toISOString(),
    activeRelease: {
      version: OPENING_RELEASE_VERSION,
      requestId: OPENING_RELEASE_REQUEST_ID,
      requirement: OPENING_RELEASE_REQUIREMENT,
      previewUrl: "/showcase",
      activatedAt: new Date().toISOString(),
      healthy: true,
    },
  },
  requests: [
    fallbackCard("QLL-018", "Turn the stock list into a sector heatmap", "Mia", "coding"),
    fallbackCard("QLL-017", "Add five-minute momentum trails", "Noah", "testing"),
    {
      ...fallbackCard(OPENING_RELEASE_REQUEST_ID, OPENING_RELEASE_REQUIREMENT, "Qoder Live Lab", "live"),
      releaseVersion: OPENING_RELEASE_VERSION,
      testSummary: "Longbridge feed · policy · tests · build verified",
    },
    {
      ...fallbackCard("QLL-015", "Modify the admin control panel", "Guardrail demo", "blocked"),
      policy: {
        outcome: "block",
        layer: "changeset",
        ruleId: "SCOPE-001",
        publicReason: "The control plane is protected.",
        evidence: ["Protected path: apps/control/app/page.tsx", "0 files promoted"],
      },
    },
  ],
};

const pipelineLanes: { key: string; statuses: RequestStatus[]; label: string; eyebrow: string }[] = [
  { key: "queued", statuses: ["queued"], label: "Queue", eyebrow: "Waiting" },
  { key: "coding", statuses: ["coding"], label: "Building", eyebrow: "Qoder Cloud Agent" },
  { key: "testing", statuses: ["testing", "deploying"], label: "Verifying", eyebrow: "Policy + tests" },
  { key: "live", statuses: ["live"], label: "Shipped", eyebrow: "Verified releases" },
];

type ChangeLogItem = { card: ChangeRequest; event: RequestEvent };
type PublicPage = "build" | "pipeline";

export default function Home() {
  const [board, setBoard] = useState(fallback);
  const [author, setAuthor] = useState("Guest");
  const [request, setRequest] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activePage, setActivePage] = useState<PublicPage>("build");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const response = await fetch("/api/board", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as BoardSnapshot;
      if (active) setBoard(next);
    };
    const kickoff = window.setTimeout(() => refresh().catch(() => undefined), 0);
    const timer = window.setInterval(() => refresh().catch(() => undefined), 2000);
    return () => {
      active = false;
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const syncPageToHash = () => setActivePage(window.location.hash === "#pipeline" ? "pipeline" : "build");
    syncPageToHash();
    window.addEventListener("hashchange", syncPageToHash);
    return () => window.removeEventListener("hashchange", syncPageToHash);
  }, []);

  const grouped = useMemo(
    () => Object.fromEntries(pipelineLanes.map((lane) => [lane.key, board.requests.filter((card) => lane.statuses.includes(card.status))])),
    [board],
  );
  const changeLog = useMemo(
    () => board.requests
      .flatMap((card) => card.events.map((event) => ({ card, event })))
      .sort((left, right) => Date.parse(right.event.createdAt) - Date.parse(left.event.createdAt))
      .slice(0, 16),
    [board],
  );
  const latestBoundary = board.requests.find((item) => item.status === "blocked" || item.status === "rejected");
  const attention = board.requests.filter((item) => item.status === "failed" || item.status === "cancelled");
  const activeRequest = board.requests.find((item) => item.id === board.system.activeRequestId);

  function selectPage(page: PublicPage) {
    setActivePage(page);
    window.history.replaceState(null, "", page === "pipeline" ? "#pipeline" : "#build");
  }

  async function submitRequest(value = request) {
    const clean = value.trim();
    if (clean.length < 20) {
      setNotice("Add a little more detail — 20 characters minimum.");
      return;
    }
    if (author.trim().length < 2) {
      setNotice("Add a nickname first.");
      return;
    }

    setSubmitting(true);
    window.localStorage.setItem("qll-nickname", author.trim());
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ author: author.trim(), title: clean, idempotencyKey: crypto.randomUUID() }),
      });
      const created = await response.json() as ChangeRequest & { error?: string };
      if (!response.ok) {
        setNotice(created.error || "The request could not be submitted.");
        return;
      }
      setRequest("");
      setNotice(created.status === "rejected"
        ? `Blocked by ${created.policy?.ruleId}. The live version was not changed.`
        : "Request accepted. Follow it in the Live Pipeline.");
      setBoard((current) => ({ ...current, requests: [created, ...current.requests.filter((item) => item.id !== created.id)] }));
      window.setTimeout(() => selectPage("pipeline"), 450);
    } catch {
      setNotice("The live queue is reconnecting. Please try once more.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="public-v2" data-page={activePage}>
      <header className="public-header-v2">
        <button type="button" className="public-brand-v2" onClick={() => selectPage("build")} aria-label="Open the Build page">
          <Image src="/qoder-line.png" alt="Qoder" width={150} height={39} priority />
          <i />
          <b>Live Lab</b>
        </button>
        <nav className="public-pages-v2" aria-label="Public pages">
          <button type="button" className={activePage === "build" ? "active" : ""} aria-pressed={activePage === "build"} onClick={() => selectPage("build")}><span>01</span> Build</button>
          <button type="button" className={activePage === "pipeline" ? "active" : ""} aria-pressed={activePage === "pipeline"} onClick={() => selectPage("pipeline")}><span>02</span> Live Pipeline</button>
        </nav>
        <div className="public-utilities-v2">
          <a href="/stage">Stage</a>
          <a href="/releases">Versions</a>
          <span className="public-live-v2"><i /> LIVE · {board.system.activeRelease.version}</span>
        </div>
      </header>

      <section className="build-page-v2" id="build" aria-labelledby="build-heading" hidden={activePage !== "build"}>
        <article className="build-story-v2">
          <p className="page-index-v2">01 / BUILD IN PUBLIC</p>
          <h1 id="build-heading">Ask for a change.<br /><em>Watch it ship.</em></h1>
          <p className="build-copy-v2">One live Hong Kong market dashboard. One bounded cloud agent. Your idea can become the next verified release while the market data keeps moving.</p>
          <div className="journey-v2" aria-label="How a request becomes live">
            <span>YOU ASK</span><i>→</i><span>QODER BUILDS</span><i>→</i><span>POLICY VERIFIES</span><i>→</i><span>LIVE</span>
          </div>
          <button type="button" className="pipeline-link-v2" onClick={() => selectPage("pipeline")}>Watch the pipeline <span>→</span></button>
        </article>

        <form className="turn-card-v2" onSubmit={(event) => { event.preventDefault(); submitRequest(); }}>
          <header>
            <div><span>YOUR TURN</span><small>LIVE AUDIENCE REQUEST</small></div>
            <b>{board.system.queuePaused ? "PAUSED" : "OPEN"}</b>
          </header>
          <h2>What should the market become next?</h2>
          <p>Describe a bold visual or interaction. Qoder may transform the whole canvas—but never the trusted data or control plane.</p>
          <label className="turn-name-v2">YOUR NICKNAME
            <input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={24} />
          </label>
          <label className="turn-request-v2">YOUR IDEA
            <textarea value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Turn it into a full-screen market heatmap with sector momentum…" maxLength={200} aria-label="Describe your feature request" />
          </label>
          <div className="turn-action-v2">
            <span>{request.length}/200</span>
            <button disabled={submitting || board.system.queuePaused} type="submit">
              {board.system.queuePaused ? "Queue paused" : submitting ? "Sending…" : "Send to Qoder"}<b>↗</b>
            </button>
          </div>
          {notice && <p className="turn-notice-v2" role="status">{notice}</p>}
          <div className="quick-ideas-v2">
            <span>NEED A SPARK?</span>
            {REHEARSAL_FEATURES.slice(0, 3).map((feature) => (
              <button type="button" key={feature.id} onClick={() => { setRequest(feature.request); setNotice("Idea loaded — make it yours or send it."); }}>
                <b>{feature.title}</b><small>{feature.impact}</small>
              </button>
            ))}
          </div>
          <div className="boundary-ideas-v2">
            <span>TEST A BOUNDARY</span>
            {GUARDRAIL_CHALLENGES.slice(0, 2).map((challenge) => (
              <button type="button" key={challenge} onClick={() => { setRequest(challenge); setNotice("Boundary challenge loaded. It should be rejected safely."); }}>{challenge}</button>
            ))}
          </div>
        </form>

        <footer className="page-proof-v2">
          <span><i /> LONG BRIDGE DATA STAYS TRUSTED</span>
          <span><i /> ONLY THE MARKET CANVAS CAN CHANGE</span>
          <span><i /> EVERY RELEASE IS TESTED</span>
        </footer>
      </section>

      <section className="pipeline-page-v2" id="pipeline" aria-labelledby="pipeline-heading" hidden={activePage !== "pipeline"}>
        <header className="pipeline-heading-v2">
          <div>
            <p className="page-index-v2">02 / LIVE PIPELINE</p>
            <h2 id="pipeline-heading">Every change.<br /><em>Visible.</em></h2>
          </div>
          <div className="pipeline-signal-v2">
            <span>AGENT SIGNAL</span>
            <b>{activeRequest ? `${activeRequest.id} · ${activeRequest.status.toUpperCase()}` : "READY FOR THE NEXT IDEA"}</b>
            <small>{activeRequest?.events.at(-1)?.message ?? "Guardrails online · queue listening"}</small>
          </div>
          <div className="pipeline-meta-v2">
            <span>STABLE <b>{board.system.activeRelease.version}</b></span>
            <span>{board.system.provider.toUpperCase()} PROVIDER</span>
            <span>AUTO-REFRESH · 2S</span>
          </div>
        </header>

        <div className="pipeline-board-v2">
          {pipelineLanes.map((lane) => (
            <PipelineLane key={lane.key} lane={lane} cards={grouped[lane.key] ?? []} />
          ))}
          <ChangeLogColumn items={changeLog} attention={attention} latestBoundary={latestBoundary} liveVersion={board.system.activeRelease.version} />
        </div>
      </section>

      <RepoGuide />
    </main>
  );
}

function PipelineLane({ lane, cards }: { lane: (typeof pipelineLanes)[number]; cards: ChangeRequest[] }) {
  return (
    <section className={`pipeline-lane-v2 lane-${lane.key}`}>
      <header><div><i />{lane.label}</div><small>{lane.eyebrow}</small></header>
      <div className="pipeline-cards-v2">
        {cards.map((card) => <RequestCard key={card.id} card={card} />)}
        {cards.length === 0 && <div className="pipeline-empty-v2">{lane.key === "queued" ? "Your idea could be next." : "No changes here right now."}</div>}
      </div>
    </section>
  );
}

function RequestCard({ card }: { card: ChangeRequest }) {
  return (
    <details className={`pipeline-card-v2 status-${card.status}`}>
      <summary>
        <div className="pipeline-card-top-v2"><span>{card.id}</span><b>{card.status.toUpperCase()}</b></div>
        <h3>{card.title}</h3>
        <p>Requested by {card.author}</p>
        <footer><span>{card.releaseVersion ?? card.testSummary ?? card.events.at(-1)?.message ?? "Awaiting evidence"}</span><b>＋</b></footer>
      </summary>
      <div className="pipeline-card-detail-v2">
        {card.policy && <div><b>{card.policy.ruleId}</b><p>{card.policy.publicReason}</p>{card.policy.evidence.map((item) => <span key={item}>↳ {item}</span>)}</div>}
        {card.files?.map((file) => <span key={file}>EDIT · {file}</span>)}
        {card.events.slice(-4).map((event) => <span key={event.id}>{event.kind.toUpperCase()} · {event.message}</span>)}
        {card.pullRequestUrl && <a href={card.pullRequestUrl} target="_blank" rel="noreferrer">Open pull request ↗</a>}
        {card.previewUrl && <a href={card.previewUrl} target="_blank" rel="noreferrer">Open preview ↗</a>}
      </div>
    </details>
  );
}

function ChangeLogColumn({ items, attention, latestBoundary, liveVersion }: { items: ChangeLogItem[]; attention: ChangeRequest[]; latestBoundary?: ChangeRequest; liveVersion: string }) {
  return (
    <aside className="pipeline-log-v2" aria-label="Change log">
      <header><div><i />CHANGE LOG</div><small>LIVE EVIDENCE</small></header>
      <div className="pipeline-log-scroll-v2">
        {latestBoundary && <BoundaryEvidence card={latestBoundary} liveVersion={liveVersion} />}
        {attention.map((card) => (
          <article className="attention-log-v2" key={card.id}>
            <div><b>{card.status.toUpperCase()}</b><time>{utcClock(card.updatedAt)}</time></div>
            <strong>{card.id}</strong>
            <p>{card.title}</p>
            <span>{card.events.at(-1)?.message ?? "The task stopped without promotion."}</span>
          </article>
        ))}
        {items.map(({ card, event }) => <ChangeLogEvent key={event.id} card={card} event={event} />)}
        {items.length === 0 && <div className="pipeline-log-empty-v2">Waiting for the next verified event.</div>}
      </div>
      <a className="all-releases-v2" href="/releases">OPEN FULL VERSION HISTORY <span>↗</span></a>
    </aside>
  );
}

function ChangeLogEvent({ card, event }: ChangeLogItem) {
  return (
    <article className={`change-event-v2 event-${event.kind}`}>
      <div><b>{event.kind.toUpperCase()}</b><time>{utcClock(event.createdAt)}</time></div>
      <strong>{card.id} · {card.status.toUpperCase()}</strong>
      <p>{event.message}</p>
    </article>
  );
}

function BoundaryEvidence({ card, liveVersion }: { card: ChangeRequest; liveVersion: string }) {
  return (
    <details className="boundary-inline-v2" id="latest-blocked-evidence" open>
      <summary><div><span>BOUNDARY EVIDENCE</span><strong>{card.id}</strong></div><b>{card.status.toUpperCase()}</b></summary>
      <div className="boundary-decision-v2"><small>POLICY DECISION</small><b>{card.policy?.ruleId ?? "POLICY"}</b><strong>{card.policy?.publicReason ?? "Candidate did not pass the guardrails."}</strong>{card.policy?.evidence.map((item) => <span key={item}>↳ {item}</span>)}</div>
      <div className="boundary-result-v2"><span>0 files promoted</span><span>Live version unchanged · {liveVersion}</span></div>
      <footer><span>COMMIT · NONE</span><span>PREVIEW · NONE</span></footer>
    </details>
  );
}

function utcClock(value: string) {
  return `${new Date(value).toISOString().slice(11, 16)} UTC`;
}

function fallbackCard(id: string, title: string, author: string, status: RequestStatus): ChangeRequest {
  const timestamp = new Date().toISOString();
  return {
    id,
    title,
    author,
    status,
    source: status === "blocked" ? "ops" : "public",
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [{ id: `evt-${id}`, requestId: id, kind: "status", message: `Task entered ${status}`, createdAt: timestamp }],
  };
}
