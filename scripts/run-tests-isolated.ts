import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { candidateVerificationEnvironment } from "../apps/runner/src/candidate-verification";

const testFiles = [
  ...(await collectTests("tests", (name) => name.endsWith(".test.ts"))),
  ...(await collectTests("apps/showcase/tests", (name) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name))),
].sort();

if (!testFiles.length) throw new Error("No candidate verification tests were found");

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  cwd: process.cwd(),
  env: candidateVerificationEnvironment(),
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

async function collectTests(directory: string, include: (name: string) => boolean): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTests(path, include);
    return entry.isFile() && include(entry.name) ? [path] : [];
  }));
  return files.flat();
}
