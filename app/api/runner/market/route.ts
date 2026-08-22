import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, runnerAuthorized } from "@/lib/api";
import { writeMarketSnapshot } from "@/lib/store";

const quoteSchema = z.object({
  symbol: z.string().min(1).max(16),
  vendorSymbol: z.string().min(3).max(24),
  name: z.string().min(1).max(64),
  sector: z.string().min(1).max(48),
  kind: z.enum(["index", "equity"]),
  currency: z.string().min(3).max(4),
  last: z.number().finite().nonnegative(),
  prevClose: z.number().finite().nonnegative(),
  open: z.number().finite().nonnegative(),
  high: z.number().finite().nonnegative(),
  low: z.number().finite().nonnegative(),
  change: z.number().finite(),
  changePercent: z.number().finite(),
  volume: z.number().finite().nonnegative(),
  turnover: z.number().finite().nonnegative(),
  timestamp: z.string().datetime(),
  trail: z.array(z.number().finite().nonnegative()).min(1).max(120),
});

const snapshotSchema = z.object({
  source: z.literal("longbridge"),
  providerLabel: z.string().min(1).max(48),
  status: z.enum(["live", "delayed", "stale", "offline"]),
  session: z.enum(["pre-open", "morning", "lunch", "afternoon", "closing", "closed"]),
  receivedAt: z.string().datetime(),
  marketTimestamp: z.string().datetime(),
  sequence: z.number().int().nonnegative(),
  indices: z.array(quoteSchema).max(8),
  quotes: z.array(quoteSchema).min(1).max(24),
});

export async function POST(request: Request) {
  if (!runnerAuthorized(request)) return jsonError("Unauthorized", 401);
  const parsed = snapshotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid market snapshot.", 422);
  await writeMarketSnapshot(parsed.data);
  return NextResponse.json({ ok: true, sequence: parsed.data.sequence });
}
