import { NextResponse } from "next/server";
import { z } from "zod";
import { answerRepoQuestion } from "@/lib/repo-guide";
import { jsonError } from "@/lib/api";

const schema = z.object({ question: z.string().trim().min(3).max(400) });
const recent = new Map<string, number[]>();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Ask a short question about this lab.");
  const client = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  const attempts = (recent.get(client) || []).filter((value) => now - value < 60_000);
  if (attempts.length >= 8) return jsonError("Question limit reached. Try again in a minute.", 429);
  recent.set(client, [...attempts, now]);
  return NextResponse.json(answerRepoQuestion(parsed.data.question));
}
