import { evaluateInput } from "@qoder-live-lab/contracts/policy";

export type GuideCitation = { label: string; path: string; url: string };
export type GuideAnswer = { answer: string; citations: GuideCitation[]; ruleId?: string };

const repository = process.env.GITHUB_REPOSITORY_URL || "https://github.com/lemondepat/qoder-live-lab";

const topics = [
  { match: /release|deploy|live|publish|上线|发布/i, answer: "Qoder creates a candidate, but only the trusted runner can activate it. The runner checks the changed paths, runs tests and CI, waits for an immutable Preview, updates the active release, and then merges. A failed candidate leaves the current stage version untouched.", files: ["apps/runner/src/index.ts", "apps/runner/src/git-pipeline.ts", "lib/store.ts"] },
  { match: /file|scope|edit|change|修改|文件|范围/i, answer: "Audience requests may radically redesign the showcase presentation, its tests, and static assets. The trusted market feed, control plane, runner, contracts, Ops, CI, dependency manifests, and security configuration are protected independently of the agent.", files: ["AGENTS.md", "packages/contracts/src/policy.ts"] },
  { match: /block|guard|policy|boundary|拦截|边界|规则/i, answer: "There are three enforcement layers: the public input gate, the agent policy, and an independent changeset/CI/deployment gate. Every stop records a public rule ID and redacted evidence, including proof that zero files were promoted.", files: ["packages/contracts/src/policy.ts", "app/api/requests/route.ts", "apps/runner/src/index.ts"] },
  { match: /secret|token|credential|密钥|凭据/i, answer: "Secrets are not mounted into the Qoder sandbox. Qoder cannot read the Neon, Vercel, Ops, or release-controller credentials, and the public event stream redacts credential-like values before display.", files: ["AGENTS.md", "apps/runner/src/control-client.ts", "lib/ops-auth.ts"], ruleId: "SECRETS-001" },
  { match: /market|price|stock|finance|行情|股价|金融/i, answer: "Computer B receives real Hong Kong quote updates through a read-only Longbridge session, publishes only sanitized market facts to Neon, and exposes them through a public read-only API. Qoder may transform the entire layout, charts, filters, motion, and storytelling, but it cannot access the provider credential, replace the feed, rewrite market facts, add trading actions, or remove the display-only disclaimer.", files: ["apps/runner/src/market-feed.ts", "app/api/market/route.ts", "apps/showcase/src/market-feed.ts", "packages/contracts/src/policy.ts"], ruleId: "DATA-001" },
  { match: /qca|cloud agent|agent/i, answer: "The runner creates an isolated task branch and a Qoder Cloud Agent session, consumes its progress through SSE, and persists provider event IDs for replay and reconnection. Raw thinking is deliberately excluded from the public board.", files: ["apps/runner/src/qca-provider.ts", "apps/runner/src/index.ts"] },
  { match: /test|ci|verify|测试|验证/i, answer: "Every candidate passes the same gate: path policy, unit tests, lint, showcase build, control build, GitHub checks, and Preview health verification. Tests may be added or strengthened, but skipping or weakening them is blocked.", files: [".github/workflows/candidate.yml", "tests/policy.test.ts"], ruleId: "TESTS-001" },
] as const;

export function answerRepoQuestion(question: string): GuideAnswer {
  const trimmed = question.trim().slice(0, 400);
  const unsafe = evaluateInput(trimmed.length < 20 ? `${trimmed} — explain this repository safely` : trimmed);
  if (unsafe.ruleId === "SECRETS-001") {
    return make("I can explain how credentials are isolated, but I cannot read or reveal any secret value. This conversation is read-only: no task was created and no files were changed.", ["AGENTS.md", "lib/ops-auth.ts"], "SECRETS-001");
  }
  if (unsafe.ruleId === "INPUT-002") {
    return make("I can answer questions about the stable repository, but I cannot follow instruction-override attempts or execute pasted code. No task was created and no files were changed.", ["packages/contracts/src/policy.ts"], "INPUT-002");
  }
  const topic = topics.find((item) => item.match.test(trimmed));
  if (topic) return make(topic.answer, [...topic.files], "ruleId" in topic ? topic.ruleId : undefined);
  return make("Qoder Live Lab is a governed delivery system: the public board accepts requests, Qoder produces an isolated candidate, independent checks decide whether it is releasable, and the stage displays only the last verified version. Ask me about releases, QCA, tests, market data, files, or guardrails for a more specific answer.", ["README.md", "packages/contracts/src/index.ts"]);
}

function make(answer: string, files: string[], ruleId?: string): GuideAnswer {
  return { answer, ruleId, citations: files.map((path) => ({ label: path.split("/").at(-1) || path, path, url: `${repository.replace(/\.git$/, "")}/blob/main/${path}` })) };
}
