import { NextResponse } from "next/server";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { claimNextRequest, getBoard, heartbeatRunner } from "@/lib/store";

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  await heartbeatRunner();
  const claimed = await claimNextRequest();
  const board = await getBoard();
  return NextResponse.json({ request: claimed, provider: board.system.provider });
}
