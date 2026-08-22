import { NextResponse } from "next/server";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { claimRunnerTask } from "@/lib/store";

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  return NextResponse.json(await claimRunnerTask());
}
