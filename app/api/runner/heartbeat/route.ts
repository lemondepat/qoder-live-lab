import { NextResponse } from "next/server";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { heartbeatRunner } from "@/lib/store";

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  await heartbeatRunner();
  return NextResponse.json({ ok: true });
}
