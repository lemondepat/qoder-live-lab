"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { OPENING_RELEASE_VERSION, type BoardSnapshot, type ChangeRequest } from "@qoder-live-lab/contracts";
import { QRCodeSVG } from "qrcode.react";
import { publicUiText } from "@/lib/public-copy";
import { isRecentBlockedEvent, STAGE_BLOCKED_DURATION_MS } from "@/lib/stage-events";

export function StageClient() {
  const [board, setBoard] = useState<BoardSnapshot>();
  const [blocked, setBlocked] = useState<ChangeRequest>();
  const lastBlockedId = useRef<string | undefined>(undefined);
  const initialized = useRef(false);
  const hideBlockedTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const next = await fetch("/api/board").then((response) => response.json()) as BoardSnapshot;
      if (!active) return;
      setBoard(next);
      const latest = next.requests.find((item) => item.status === "blocked" || item.status === "rejected");
      const shouldShow = initialized.current ? latest?.id !== lastBlockedId.current : isRecentBlockedEvent(latest);
      initialized.current = true;
      if (latest) lastBlockedId.current = latest.id;
      if (latest && shouldShow) {
        lastBlockedId.current = latest.id;
        setBlocked(latest);
        window.clearTimeout(hideBlockedTimer.current);
        hideBlockedTimer.current = window.setTimeout(() => setBlocked(undefined), STAGE_BLOCKED_DURATION_MS);
      }
    };
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 20_000);
    return () => { active = false; window.clearInterval(timer); window.clearTimeout(hideBlockedTimer.current); };
  }, []);

  const release = board?.system.activeRelease;
  const activeRequest = board?.requests.find((item) => item.id === board.system.activeRequestId);
  const releaseRequest = board?.requests.find((item) => item.id === release?.requestId);
  const displayedRequest = activeRequest ?? releaseRequest;
  const stagePreviewUrl = process.env.NODE_ENV === "development" ? "/showcase" : release?.previewUrl || "/showcase";
  return (
    <main className="stage-shell">
      <header className="stage-bar">
        <div className="stage-brand" aria-label="Qoder Live Lab">
          <Image src="/qoder-line.png" alt="Qoder" width={150} height={39} priority />
          <b>Live Lab</b>
        </div>
        <div className="stage-now">
          <span>{stageStatusLabel(activeRequest)} <em>· BY {displayedRequest?.author ?? "Qoder Live Lab"}</em></span>
          <strong>{publicUiText(displayedRequest?.title ?? release?.requirement) || "Hong Kong market dashboard"}</strong>
        </div>
        <div className="stage-version">
          <div className="stage-qr">
            <span>SCAN<br />TO BUILD</span>
            <QRCodeSVG value={process.env.NEXT_PUBLIC_SITE_URL || "https://qoder.com"} size={42} bgColor="transparent" fgColor="#f4f1e9" />
          </div>
          <div className="stage-live"><i /><span>LIVE</span><b>{release?.version ?? OPENING_RELEASE_VERSION}</b></div>
        </div>
      </header>
      <div className="stage-frame-wrap" key={stagePreviewUrl}>
        <iframe title="Current verified market dashboard" src={stagePreviewUrl} sandbox="allow-scripts allow-pointer-lock allow-same-origin" />
      </div>
      {blocked && <div className="stage-blocked" role="status"><span>×</span><div><b>CHANGE BLOCKED · {blocked.policy?.ruleId ?? "POLICY"}</b><strong>{publicUiText(blocked.policy?.publicReason) || "Candidate did not pass the guardrails."}</strong><small>0 files promoted · Live version remains {release?.version ?? OPENING_RELEASE_VERSION}</small></div></div>}
    </main>
  );
}

function stageStatusLabel(request?: ChangeRequest) {
  if (!request) return "CURRENT RELEASE";
  if (request.status === "queued") return "YOU ASK";
  if (request.status === "coding") return "QODER BUILDS";
  if (request.status === "testing") return "QODER VERIFIES";
  if (request.status === "deploying") return "QODER DEPLOYS";
  if (request.status === "live") return "LIVE";
  return "CHANGE STOPPED";
}
