import { loadConfig } from "./config";

const config = loadConfig();
const required = {
  QODER_PAT: config.qoderPat,
  QODER_CLOUD_AGENT_ID: config.qoderAgentId,
  QODER_CLOUD_ENVIRONMENT_ID: config.qoderEnvironmentId,
  GITHUB_REPOSITORY_URL: config.githubRepositoryUrl,
  QODER_GITHUB_TOKEN: config.qoderGithubToken,
  GITHUB_TOKEN: config.githubToken,
};
const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) {
  process.stderr.write(`QCA setup incomplete. Missing: ${missing.join(", ")}\n`);
  process.exitCode = 1;
} else {
  const headers = { authorization: `Bearer ${config.qoderPat}` };
  const [agents, environments] = await Promise.all([
    fetch(`${config.qoderApiBase}/agents?limit=100`, { headers }),
    fetch(`${config.qoderApiBase}/environments?limit=100`, { headers }),
  ]);
  if (!agents.ok || !environments.ok) {
    process.stderr.write(`QCA API unavailable. Agents: ${agents.status}; Environments: ${environments.status}\n`);
    process.exitCode = 1;
  } else {
    const agentData = await agents.json() as { data: Array<{ id: string }> };
    const environmentData = await environments.json() as { data: Array<{ id: string }> };
    const agentFound = agentData.data.some((item) => item.id === config.qoderAgentId);
    const environmentFound = environmentData.data.some((item) => item.id === config.qoderEnvironmentId);
    process.stdout.write(`QCA authentication: OK\nAgent: ${agentFound ? "OK" : "NOT FOUND"}\nEnvironment: ${environmentFound ? "OK" : "NOT FOUND"}\n`);
    if (!agentFound || !environmentFound) process.exitCode = 1;
  }
}
