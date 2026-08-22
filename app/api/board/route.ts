import { NextResponse } from "next/server";
import { getBoard } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const board = await getBoard();
  return NextResponse.json(board, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=15, stale-if-error=60",
      "Vercel-CDN-Cache-Control": "public, s-maxage=15, stale-if-error=60",
    },
  });
}
