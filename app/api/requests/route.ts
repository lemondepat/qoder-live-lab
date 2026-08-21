import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createRequest, RequestLimitError } from "@/lib/store";
import { jsonError } from "@/lib/api";

const inputSchema = z.object({
  author: z.string().trim().min(2).max(24),
  title: z.string().trim().min(1).max(240),
  idempotencyKey: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please provide a nickname and a clear request.");
  const jar = await cookies();
  const deviceId = jar.get("qll_device")?.value || crypto.randomUUID();
  try {
    const result = await createRequest({ ...parsed.data, deviceId });
    const response = NextResponse.json(result, { status: result.status === "rejected" ? 202 : 201 });
    response.cookies.set("qll_device", deviceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    return response;
  } catch (error) {
    if (error instanceof RequestLimitError) return jsonError(error.message, 429);
    throw error;
  }
}
