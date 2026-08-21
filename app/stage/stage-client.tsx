"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardSnapshot, ChangeRequest } from "@qoder-live-lab/contracts";
import { QRCodeSVG } from "qrcode.react";

export function StageClient() {
  const [board, setBoard] = useState<BoardSnapshot>();
  const [blocked, setBlocked] = useState<ChangeRequest>();
  const lastBlockedId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const next = await fetch("/api/board", { cache: "no-store" }).then((response) => response.json()) as BoardSnapshot;
      if (!active) return;
      setBoard(next);
      const latest = next.requests.find((item) => item.status === "blocked" || item.status === "rejected");
      if (latest && latest.id !== lastBlockedId.current) {
        lastBlockedId.current = latest.id;
        setBlocked(latest);
        window.setTimeout(() => setBlocked(undefined), 8000);
      }
    };
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const release = board?.system.activeRelease;
  const activeRequest = board?.requests.find((item) => item.id === board.system.activeRequestId);
  return (
    <main className="stage-shell">
      <header className="stage-bar">
        <div className="stage-brand"><span>Q</span><div><b>Qoder Live Lab</b><small>Autonomous engineering · visibly bounded</small></div></div>
        <div className="stage-now"><span>{activeRequest ? "BUILDING NOW" : "CURRENT RELEASE"}</span><strong>{activeRequest?.title ?? release?.requirement ?? "Hong Kong market dashboard"}</strong></div>
        <div className="stage-version"><div className="stage-qr"><QRCodeSVG value={process.env.NEXT_PUBLIC_SITE_URL || "https://qoder.com"} size={42} bgColor="transparent" fgColor="#f4f1e9" /><span>SCAN<br />TO BUILD</span></div><i />LIVE <b>{release?.version ?? "v0.4"}</b></div>
      </header>
      <div className="stage-frame-wrap" key={release?.previewUrl}>
        <iframe title="Current verified market dashboard" src={release?.previewUrl || "/showcase"} sandbox="allow-scripts allow-pointer-lock" />
      </div>
      {blocked && <div className="stage-blocked" role="status"><span>×</span><div><b>CHANGE BLOCKED · {blocked.policy?.ruleId ?? "POLICY"}</b><strong>{blocked.policy?.publicReason ?? "Candidate did not pass the guardrails."}</strong><small>0 files promoted · Live version remains {release?.version ?? "v0.4"}</small></div></div>}
    </main>
  );
}
