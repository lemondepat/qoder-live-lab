"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BoardSnapshot, ChangeRequest, Release } from "@qoder-live-lab/contracts";

type ReleaseRecord = Release & { request?: ChangeRequest };

export function ReleasesClient() {
  const [board, setBoard] = useState<BoardSnapshot>();
  const [selected, setSelected] = useState<ReleaseRecord>();

  useEffect(() => { let active = true; const refresh = () => fetch("/api/board", { cache: "no-store" }).then((response) => response.json()).then((next: BoardSnapshot) => { if (active) setBoard(next); }); const kickoff = window.setTimeout(() => refresh().catch(() => undefined), 0); const timer = window.setInterval(() => refresh().catch(() => undefined), 3000); return () => { active = false; clearTimeout(kickoff); clearInterval(timer); }; }, []);

  const releases = useMemo<ReleaseRecord[]>(() => {
    if (!board) return [];
    const records: ReleaseRecord[] = board.requests.filter((item) => item.status === "live" && item.releaseVersion && item.previewUrl).map((request) => ({ version: request.releaseVersion!, requestId: request.id, requirement: request.title, previewUrl: request.previewUrl!, commitSha: request.commitSha, activatedAt: request.completedAt || request.updatedAt, healthy: true, request }));
    for (const release of [board.system.activeRelease, board.system.previousRelease]) if (release && !records.some((item) => item.version === release.version)) records.push({ ...release, request: board.requests.find((item) => item.id === release.requestId) });
    return records.sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime());
  }, [board]);

  const current = board?.system.activeRelease;
  return <main className="release-shell"><header className="release-topbar"><Link href="/">← PUBLIC BOARD</Link><div><span>Q</span><b>RELEASE HISTORY</b></div><Link href="/stage">OPEN STAGE ↗</Link></header><section className="release-hero"><p>EVERY VERSION · EVERY DECISION</p><h1>See what changed.<br /><em>See why it shipped.</em></h1><div><span>CURRENT VERIFIED RELEASE</span><strong>{current?.version || "—"}</strong><small>{current?.requirement}</small></div></section><section className="release-layout"><div className="release-timeline">{releases.map((release, index) => <button key={release.version} className={selected?.version === release.version ? "selected" : ""} onClick={() => setSelected(release)}><span>{String(releases.length - index).padStart(2, "0")}</span><div><small>{release.version} · {new Date(release.activatedAt).toLocaleString()}</small><h2>{release.requirement}</h2><p>{release.request?.files?.length ?? 0} files changed · {release.request?.testSummary || "Verified release"}</p></div><b>{release.version === current?.version ? "LIVE" : "VIEW"}</b></button>)}</div><aside className="release-evidence">{selected ? <><span>RELEASE EVIDENCE / {selected.version}</span><h2>{selected.requirement}</h2><div className="release-proof"><small>POLICY</small><b>{selected.request?.policy?.ruleId || "VERIFIED"}</b><p>{selected.request?.policy?.publicReason || "This release passed the trusted promotion path."}</p></div><div className="release-proof"><small>TESTS</small><b>{selected.request?.testSummary || "Release checks passed"}</b></div><div className="release-files">{selected.request?.files?.map((file) => <span key={file}>EDIT · {file}</span>) || <span>BASELINE · Initial market canvas</span>}</div><div className="release-links"><a href={selected.previewUrl} target="_blank" rel="noreferrer">OPEN THIS VERSION ↗</a>{selected.request?.pullRequestUrl && <a href={selected.request.pullRequestUrl} target="_blank" rel="noreferrer">VIEW PULL REQUEST ↗</a>}</div><footer>IMMUTABLE PREVIEW · {selected.commitSha?.slice(0, 8) || "BASELINE"}</footer></> : <div className="release-empty"><span>↖</span><p>Select a release to inspect its files, tests, policy decision, and immutable Preview.</p></div>}</aside></section></main>;
}
