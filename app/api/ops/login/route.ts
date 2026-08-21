import { NextResponse } from "next/server";
import { createOpsSession } from "@/lib/ops-auth";
import { jsonError } from "@/lib/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { passcode?: string } | null;
  const expected = process.env.OPS_PASSCODE || "qoder-live";
  if (!body?.passcode || body.passcode !== expected) return jsonError("Incorrect operator passcode", 401);
  await createOpsSession();
  return NextResponse.json({ ok: true });
}
