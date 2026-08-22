import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const snapshot = await getMarketSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "public, s-maxage=1, stale-while-revalidate=2",
    },
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = origin && (
    origin === "https://qoder-live-lab-canvas.vercel.app" ||
    /^https:\/\/qoder-live-lab-canvas-[a-z0-9-]+\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin)
  );
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}
