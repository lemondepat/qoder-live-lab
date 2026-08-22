"use client";

import { useState } from "react";

type Answer = { answer: string; citations: Array<{ label: string; path: string; url: string }>; ruleId?: string };
const suggestions = ["How does a release become live?", "Which files can Qoder modify?", "How is market data protected?", "Why can a change be blocked?"];

export function RepoGuide() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer>();
  const [loading, setLoading] = useState(false);

  async function ask(value = question) {
    if (value.trim().length < 3) return;
    setQuestion(value);
    setLoading(true);
    const response = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: value }) });
    const next = await response.json() as Answer & { error?: string };
    setLoading(false);
    setAnswer(response.ok ? next : { answer: next.error || "The repository guide is unavailable.", citations: [] });
  }

  return <><button className="ask-launcher" onClick={() => setOpen(true)}><span className="qoder-brand-icon" aria-hidden="true" /><div><b>ASK ABOUT THIS LAB</b><small>Read-only code guide</small></div><i>↗</i></button>{open && <aside className="ask-drawer" aria-label="Ask about this repository"><header><div><span className="qoder-brand-icon" aria-hidden="true" /><div><b>ASK ABOUT THIS LAB</b><small>STABLE MAIN · READ ONLY</small></div></div><button aria-label="Close repository guide" onClick={() => setOpen(false)}>×</button></header><section className="ask-body"><p className="ask-intro">Ask how the code, release pipeline, market data, or guardrails work. Questions never create development tasks.</p><div className="ask-suggestions">{suggestions.map((item) => <button key={item} onClick={() => ask(item)}>{item}</button>)}</div>{(answer || loading) && <article className="ask-answer"><span>{loading ? "READING STABLE MAIN…" : answer?.ruleId ? `${answer.ruleId} · GROUNDED ANSWER` : "GROUNDED ANSWER"}</span><p>{loading ? "Finding the smallest set of relevant source files." : answer?.answer}</p>{answer?.citations.map((citation) => <a key={citation.path} href={citation.url} target="_blank" rel="noreferrer">↳ {citation.path}</a>)}</article>}</section><form onSubmit={(event) => { event.preventDefault(); ask(); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about releases, policies, or QCA…" maxLength={400} /><button disabled={loading} aria-label="Ask question">↑</button></form><footer>NO TASK CREATED · NO FILES CHANGED</footer></aside>}</>;
}
