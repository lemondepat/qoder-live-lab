import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { finishRequest } from "@/lib/store";

const schema = z.object({
  requestId: z.string(),
  status: z.enum(["live", "blocked", "failed", "cancelled"]),
  previewUrl: z.string().url().optional(),
  commitSha: z.string().optional(),
  branch: z.string().optional(),
  pullRequestUrl: z.string().url().optional(),
  testSummary: z.string().max(200).optional(),
  files: z.array(z.string()).max(30).optional(),
  policy: z.object({ outcome: z.enum(["allow", "reject", "block"]), layer: z.enum(["input", "agent", "changeset", "ci", "deployment"]), ruleId: z.string(), publicReason: z.string(), evidence: z.array(z.string()) }).optional(),
});

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid completion payload");
  const { requestId, status, ...patch } = parsed.data;
  const result = await finishRequest(requestId, status, patch);
  if (!result) return jsonError("Request not found", 404);
  return NextResponse.json(result);
}
