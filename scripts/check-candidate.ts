import { execFileSync } from "node:child_process";
import { evaluateChanges } from "@qoder-live-lab/contracts/policy";

const base = process.env.BASE_REF || "origin/main";
const head = process.env.HEAD_REF || "HEAD";
const run = (args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const files = run(["diff", "--name-only", `${base}...${head}`]).split(/\r?\n/).filter(Boolean);
const diff = run(["diff", "--unified=2", `${base}...${head}`]);
const decision = evaluateChanges(files, diff);
process.stdout.write(`${decision.ruleId}: ${decision.publicReason}\n${decision.evidence.join("\n")}\n`);
if (decision.outcome !== "allow") process.exitCode = 1;
