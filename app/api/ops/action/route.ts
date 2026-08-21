import { NextResponse } from "next/server";
import { z } from "zod";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { jsonError } from "@/lib/api";
import { createBoundaryChallenge, finishRequest, getBoard, rollbackRelease, setSystem } from "@/lib/store";
import { GUARDRAIL_CHALLENGES } from "@qoder-live-lab/contracts/policy";

const schema = z.object({ action: z.enum(["pause", "resume", "provider-qca", "provider-local", "rollback", "cancel", "challenge"]), challenge: z.string().optional() });

export async function POST(request: Request) {
  if (!(await isOpsAuthenticated())) return jsonError("Operator sign-in required", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Unknown operator action");
  const { action } = parsed.data;
  if (action === "pause") await setSystem({ queuePaused: true });
  if (action === "resume") await setSystem({ queuePaused: false });
  if (action === "provider-qca") await setSystem({ provider: "qca" });
  if (action === "provider-local") await setSystem({ provider: "local" });
  if (action === "rollback") await rollbackRelease();
  if (action === "challenge") await createBoundaryChallenge(parsed.data.challenge || GUARDRAIL_CHALLENGES[1]);
  if (action === "cancel") {
    const board = await getBoard();
    if (board.system.activeRequestId) await finishRequest(board.system.activeRequestId, "cancelled");
  }
  return NextResponse.json(await getBoard());
}
