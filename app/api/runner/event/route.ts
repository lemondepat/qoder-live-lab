import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { appendEvent, updateRequest } from "@/lib/store";

const schema = z.object({
  requestId: z.string(),
  kind: z.enum(["status", "agent", "test", "policy", "release"]),
  message: z.string().min(1).max(240),
  providerEventId: z.string().optional(),
  status: z.enum(["queued", "coding", "testing", "deploying", "live", "rejected", "blocked", "failed", "cancelled"]).optional(),
  qcaSessionId: z.string().optional(),
});

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid runner event");
  const { requestId, status, qcaSessionId, ...event } = parsed.data;
  await appendEvent(requestId, event);
  if (status || qcaSessionId) await updateRequest(requestId, { status, qcaSessionId });
  return NextResponse.json({ ok: true });
}
