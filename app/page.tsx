"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  OPENING_RELEASE_REQUEST_ID,
  OPENING_RELEASE_REQUIREMENT,
  OPENING_RELEASE_VERSION,
  type BoardSnapshot,
  type ChangeRequest,
  type Release,
  type RequestStatus,
} from "@qoder-live-lab/contracts";
import { REHEARSAL_FEATURES } from "@qoder-live-lab/contracts/features";
import { GUARDRAIL_CHALLENGES } from "@qoder-live-lab/contracts/policy";
import { publicUiText } from "@/lib/public-copy";

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
      testSummary: "Market feed · policy · tests · build verified",
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
  { key: "queued", statuses: ["queued"], label: "You Ask", eyebrow: "Audience queue" },
  { key: "coding", statuses: ["coding"], label: "Qoder Builds", eyebrow: "Cloud Agent" },
  { key: "testing", statuses: ["testing"], label: "Qoder Verifies", eyebrow: "Tests + guardrails" },
  { key: "deploying", statuses: ["deploying"], label: "Qoder Deploys", eyebrow: "Trusted release" },
  { key: "live", statuses: ["live"], label: "Live", eyebrow: "Verified release" },
  { key: "failed", statuses: ["rejected", "blocked", "failed", "cancelled"], label: "Failed Changes", eyebrow: "Not promoted" },
];

type PublicPage = "build" | "pipeline";

export default function Home() {
  const [board, setBoard] = useState(fallback);
  const [author, setAuthor] = useState("Guest");
  const [request, setRequest] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activePage, setActivePage] = useState<PublicPage>("build");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const response = await fetch("/api/board");
      if (!response.ok) return;
      const next = await response.json() as BoardSnapshot;
      if (active) setBoard(next);
    };
    const kickoff = window.setTimeout(() => refresh().catch(() => undefined), 0);
    const timer = window.setInterval(() => refresh().catch(() => undefined), 20_000);
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

  useEffect(() => {
    if (!selectedTicketId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTicketId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTicketId]);

  const grouped = useMemo(
    () => Object.fromEntries(pipelineLanes.map((lane) => [lane.key, board.requests.filter((card) => lane.statuses.includes(card.status))])),
    [board],
  );
  const selectedTicket = board.requests.find((item) => item.id === selectedTicketId);

  function selectPage(page: PublicPage) {
    setSelectedTicketId(null);
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
          <b>Live Lab</b>
        </button>
        <nav className="public-pages-v2" aria-label="Public pages">
          <button type="button" className={activePage === "build" ? "active" : ""} aria-pressed={activePage === "build"} onClick={() => selectPage("build")}><span>01</span> Build</button>
          <button type="button" className={activePage === "pipeline" ? "active" : ""} aria-pressed={activePage === "pipeline"} onClick={() => selectPage("pipeline")}><span>02</span> Live Pipeline</button>
        </nav>
        <div className="public-utilities-v2">
          <a href="/stage">Stage</a>
          <span className="public-live-v2"><i /> LIVE · {board.system.activeRelease.version}</span>
        </div>
      </header>

      <section className="build-page-v2" id="build" aria-labelledby="build-heading" hidden={activePage !== "build"}>
        <article className="build-story-v2">
          <h1 id="build-heading">Ask for a change.<br /><em>Watch it ship.</em></h1>
          <p className="build-copy-v2">One live Hong Kong market dashboard. One bounded Qoder Cloud Agent. Your idea can become the next verified release while the market data keeps moving.</p>
          <div className="journey-v2" aria-label="How a request becomes live">
            <span>YOU ASK</span><i>→</i><span>QODER BUILDS</span><i>→</i><span>QODER VERIFIES</span><i>→</i><span>QODER DEPLOYS</span><i>→</i><span>LIVE</span>
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
            <input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={24} autoComplete="nickname" />
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

      </section>

      <section className="pipeline-page-v2" id="pipeline" aria-label="Live Pipeline" hidden={activePage !== "pipeline"}>
        <div className="pipeline-board-v2" aria-label="Live pipeline columns; swipe horizontally on mobile">
          {pipelineLanes.map((lane) => (
            <PipelineLane key={lane.key} lane={lane} cards={grouped[lane.key] ?? []} onSelect={setSelectedTicketId} />
          ))}
        </div>
      </section>

      {selectedTicket && <TicketDialog card={selectedTicket} activeRelease={board.system.activeRelease} previousRelease={board.system.previousRelease} onClose={() => setSelectedTicketId(null)} />}
    </main>
  );
}

function PipelineLane({ lane, cards, onSelect }: { lane: (typeof pipelineLanes)[number]; cards: ChangeRequest[]; onSelect: (id: string) => void }) {
  return (
    <section className={`pipeline-lane-v2 lane-${lane.key}`}>
      <header><div><i />{lane.label}</div><small>{lane.eyebrow}</small></header>
      <div className="pipeline-cards-v2" role="region" aria-label={`${lane.label} requests`}>
        {cards.map((card) => <RequestCard key={card.id} card={card} onSelect={onSelect} />)}
        {cards.length === 0 && <div className="pipeline-empty-v2">{lane.key === "queued" ? "Your idea could be next." : "No changes here right now."}</div>}
      </div>
    </section>
  );
}

function RequestCard({ card, onSelect }: { card: ChangeRequest; onSelect: (id: string) => void }) {
  return (
    <button type="button" className={`pipeline-card-v2 status-${card.status}`} onClick={() => onSelect(card.id)} aria-haspopup="dialog">
      <span className="pipeline-card-top-v2"><span>{card.id}</span><b>{publicStatusLabel(card.status)}</b></span>
      <strong className="pipeline-card-title-v2">{publicUiText(card.title)}</strong>
      <span className="pipeline-card-requester-v2">Requested by {card.author}</span>
      <span className="pipeline-card-footer-v2"><span>{(card.releaseVersion ?? publicUiText(card.testSummary ?? card.events.at(-1)?.message)) || "Awaiting evidence"}</span><b>↗</b></span>
    </button>
  );
}

function TicketDialog({ card, activeRelease, previousRelease, onClose }: { card: ChangeRequest; activeRelease: Release; previousRelease?: Release; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const release = [activeRelease, previousRelease].find((item) => item?.requestId === card.id);
  const releaseVersion = card.releaseVersion ?? release?.version;
  const releasePreviewUrl = card.previewUrl ?? release?.previewUrl;
  const releaseCommit = card.commitSha ?? release?.commitSha;
  const releaseActivatedAt = release?.activatedAt ?? card.completedAt;
  const qoderSessionUrl = card.qcaSessionId ? `https://qoder.com/cloud/sessions/${encodeURIComponent(card.qcaSessionId)}` : undefined;
  const promoted = card.status === "live" && Boolean(releaseVersion);
  const currentRelease = promoted && (activeRelease.requestId === card.id || activeRelease.version === releaseVersion);
  const stopped = ["rejected", "blocked", "failed", "cancelled"].includes(card.status);

  useEffect(() => { closeButtonRef.current?.focus(); }, []);

  return (
    <div className="ticket-modal-backdrop-v2">
      <section className={`ticket-modal-v2 status-${card.status}`} role="dialog" aria-modal="true" aria-labelledby="ticket-modal-heading">
        <header className="ticket-modal-header-v2">
          <div><span>TICKET / VERSION DETAIL</span><b>{card.id}</b></div>
          <div><strong>{publicStatusLabel(card.status)}</strong><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close ticket details">×</button></div>
        </header>

        <div className="ticket-modal-scroll-v2">
          <section className="ticket-modal-hero-v2">
            <div><small>REQUIREMENT</small><h2 id="ticket-modal-heading">{publicUiText(card.title)}</h2><p>Requested by <b>{card.author}</b> · {formatTicketDate(card.createdAt)}</p></div>
            <div className="ticket-modal-release-mark-v2"><span>{promoted ? currentRelease ? "CURRENT RELEASE" : "VERIFIED VERSION" : "RELEASE STATUS"}</span><strong>{releaseVersion ?? "NOT RELEASED"}</strong><small>{promoted ? formatTicketDate(releaseActivatedAt) : stopped ? "Candidate stopped before promotion" : "Work in progress"}</small></div>
          </section>

          <div className="ticket-modal-grid-v2">
            <section className="ticket-modal-panel-v2">
              <header><span>CURRENT REQUEST</span><b>{publicStatusLabel(card.status)}</b></header>
              <dl className="ticket-facts-v2">
                <div><dt>LAST UPDATE</dt><dd>{formatTicketDate(card.updatedAt)}</dd></div>
                <div><dt>AGENT</dt><dd>{card.qcaSessionId ? "QODER CLOUD AGENT" : card.source === "ops" ? "BOUNDARY CHALLENGE" : "QUEUE"}</dd></div>
                <div><dt>BRANCH</dt><dd>{card.branch ?? "NOT CREATED"}</dd></div>
                <div><dt>FILES</dt><dd>{card.files?.length ?? 0} CHANGED</dd></div>
              </dl>
              <div className="ticket-timeline-v2">
                <span>QODER CLOUD AGENT PROGRESS</span>
                {card.events.slice(-8).map((event) => <div key={event.id}><time>{formatTicketClock(event.createdAt)}</time><i /><p><b>{event.kind.toUpperCase()}</b>{publicUiText(event.message)}</p></div>)}
                {card.events.length === 0 && <p className="ticket-empty-v2">Awaiting the first agent event.</p>}
              </div>
            </section>

            <section className="ticket-modal-panel-v2 ticket-version-panel-v2">
              <header><span>VERSION EVIDENCE</span><b>{promoted ? currentRelease ? "LIVE" : "IMMUTABLE" : "NO RELEASE"}</b></header>
              {stopped && <div className="ticket-stop-proof-v2"><strong>0 FILES PROMOTED</strong><span>Live version unchanged · {activeRelease.version}</span></div>}
              <div className="ticket-proof-v2">
                <small>POLICY</small>
                <b>{card.policy?.ruleId ?? (promoted ? "VERIFIED" : "PENDING")}</b>
                <p>{publicUiText(card.policy?.publicReason) || (promoted ? "This release passed the trusted promotion path." : "No policy decision has been recorded yet.")}</p>
                {card.policy?.evidence.map((item) => <span key={item}>↳ {publicUiText(item)}</span>)}
              </div>
              <div className="ticket-proof-v2"><small>TESTS & BUILD</small><b>{publicUiText(card.testSummary) || (promoted ? "Release checks passed" : stopped ? "Candidate was not eligible for promotion" : "Verification has not completed")}</b></div>
              <div className="ticket-files-v2"><small>FILES CHANGED</small>{card.files?.length ? card.files.map((file) => <span key={file}>EDIT · {file}</span>) : <span>{promoted ? "BASELINE · No file list recorded" : "NO PROMOTED FILES"}</span>}</div>
              <div className="ticket-version-meta-v2"><span>COMMIT</span><b>{releaseCommit?.slice(0, 10) ?? "NONE"}</b><span>ACTIVATED</span><b>{promoted ? formatTicketDate(releaseActivatedAt) : "NEVER"}</b></div>
            </section>
          </div>
        </div>

        <footer className="ticket-modal-footer-v2">
          <span>{promoted ? `IMMUTABLE PREVIEW · ${releaseVersion}` : stopped ? `NOT PROMOTED · ${activeRelease.version} REMAINS LIVE` : "CANDIDATE IN PROGRESS"}</span>
          <div>{qoderSessionUrl && <a className="ticket-qoder-link-v2" href={qoderSessionUrl} target="_blank" rel="noreferrer">QODER CLOUD SESSION ↗</a>}{card.pullRequestUrl && <a href={card.pullRequestUrl} target="_blank" rel="noreferrer">VIEW PULL REQUEST ↗</a>}{releasePreviewUrl && <a href={releasePreviewUrl} target="_blank" rel="noreferrer">OPEN {promoted ? "THIS VERSION" : "PREVIEW"} ↗</a>}</div>
        </footer>
      </section>
    </div>
  );
}

function formatTicketDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).format(new Date(value)) + " HKT";
}

function formatTicketClock(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).format(new Date(value));
}

function publicStatusLabel(status: RequestStatus) {
  if (status === "queued") return "YOU ASK";
  if (status === "coding") return "QODER BUILDS";
  if (status === "testing") return "QODER VERIFIES";
  if (status === "deploying") return "QODER DEPLOYS";
  if (status === "live") return "LIVE";
  return status.toUpperCase();
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
