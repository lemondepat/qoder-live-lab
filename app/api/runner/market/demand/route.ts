import { NextResponse } from "next/server";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { claimMarketIntradayDemands } from "@/lib/store";

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  const symbols = await claimMarketIntradayDemands(5);
  return NextResponse.json({ symbols });
}
