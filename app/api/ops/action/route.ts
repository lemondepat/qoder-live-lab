import { NextResponse } from "next/server";
import { z } from "zod";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { jsonError } from "@/lib/api";
import { createBoundaryChallenge, createRehearsalFeature, finishRequest, getBoard, resetOpeningRelease, rollbackRelease, setSystem } from "@/lib/store";
import { GUARDRAIL_CHALLENGES } from "@qoder-live-lab/contracts/policy";
import { REHEARSAL_FEATURES } from "@qoder-live-lab/contracts/features";

const schema = z.object({ action: z.enum(["pause", "resume", "provider-qca", "provider-local", "rollback", "opening-baseline", "cancel", "challenge", "feature"]), challenge: z.string().optional(), featureId: z.string().optional() });

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
  if (action === "opening-baseline") await resetOpeningRelease();
  if (action === "challenge") await createBoundaryChallenge(parsed.data.challenge || GUARDRAIL_CHALLENGES[1]);
  if (action === "feature") {
    const feature = REHEARSAL_FEATURES.find((item) => item.id === parsed.data.featureId);
    if (!feature) return jsonError("Unknown rehearsal feature");
    await createRehearsalFeature(feature);
  }
  if (action === "cancel") {
    const board = await getBoard();
    if (board.system.activeRequestId) await finishRequest(board.system.activeRequestId, "cancelled");
  }
  return NextResponse.json(await getBoard());
}
