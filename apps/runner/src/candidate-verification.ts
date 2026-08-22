export const CANDIDATE_VERIFICATION_SCRIPT = "verify:candidate";
export const CANDIDATE_VERIFICATION_COMMAND = `npm run ${CANDIDATE_VERIFICATION_SCRIPT}`;
export const CANDIDATE_VERIFICATION_ARGS = ["run", CANDIDATE_VERIFICATION_SCRIPT] as const;

export const CANDIDATE_SECRET_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "NEON_API_KEY",
  "PGDATABASE",
  "PGHOST",
  "PGHOST_UNPOOLED",
  "PGPASSWORD",
  "PGUSER",
  "POSTGRES_DATABASE",
  "POSTGRES_HOST",
  "POSTGRES_PASSWORD",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_NO_SSL",
  "POSTGRES_USER",
  "OPS_PASSCODE",
  "OPS_SESSION_SECRET",
  "RUNNER_TOKEN",
  "QODER_PAT",
  "QODER_GITHUB_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_OIDC_TOKEN",
  "NPM_TOKEN",
  "NODE_AUTH_TOKEN",
  "LONGBRIDGE_APP_KEY",
  "LONGBRIDGE_APP_SECRET",
  "LONGBRIDGE_ACCESS_TOKEN",
] as const;

export function candidateVerificationEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): NodeJS.ProcessEnv {
  const environment: Record<string, string | undefined> = { ...source, SEED_DEMO_DATA: "false" };
  for (const key of CANDIDATE_SECRET_ENV_KEYS) delete environment[key];
  return environment as NodeJS.ProcessEnv;
}
