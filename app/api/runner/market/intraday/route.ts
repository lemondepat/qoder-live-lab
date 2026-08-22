import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { writeMarketIntradaySnapshots } from "@/lib/store";

const intradayPointSchema = z.object({
  timestamp: z.string().datetime(),
  price: z.number().finite().positive(),
  averagePrice: z.number().finite().positive().optional(),
  volume: z.number().finite().nonnegative(),
  turnover: z.number().finite().nonnegative(),
});

const intradaySnapshotSchema = z.object({
  symbol: z.string().min(1).max(16),
  vendorSymbol: z.string().min(3).max(24),
  tradingDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receivedAt: z.string().datetime(),
  sequence: z.number().int().nonnegative(),
  points: z.array(intradayPointSchema).min(1).max(420),
});

const bodySchema = z.object({ snapshots: z.array(intradaySnapshotSchema).min(1).max(20) });

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid intraday snapshot batch.", 422);
  await writeMarketIntradaySnapshots(parsed.data.snapshots);
  return NextResponse.json({ ok: true, symbols: parsed.data.snapshots.map((snapshot) => snapshot.symbol) });
}
