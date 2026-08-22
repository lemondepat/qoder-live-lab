import { NextResponse } from "next/server";
import { z } from "zod";
import type { MarketIntradayResponse, MarketQuoteSnapshot } from "@qoder-live-lab/contracts";
import { enqueueMarketIntradayDemand, getMarketIntradaySnapshot, getMarketSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ symbol: z.string().trim().min(1).max(24) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resolved = await resolveSupportedSymbol(url.searchParams.get("symbol") ?? "");
  if (!resolved) return jsonError("Symbol is outside the supported market universe.", 404, request);
  const snapshot = await getMarketIntradaySnapshot(resolved.vendorSymbol);
  const response: MarketIntradayResponse = snapshot
    ? { status: "ready", symbol: resolved.symbol, vendorSymbol: resolved.vendorSymbol, snapshot }
    : { status: "pending", symbol: resolved.symbol, vendorSymbol: resolved.vendorSymbol };
  const cacheHeaders = snapshot
    ? {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-if-error=60",
        "Vercel-CDN-Cache-Control": "public, s-maxage=15, stale-if-error=60",
      }
    : {
        "Cache-Control": "no-store, max-age=0",
        "Vercel-CDN-Cache-Control": "no-store",
      };
  return NextResponse.json(response, {
    headers: {
      ...corsHeaders(request),
      ...cacheHeaders,
    },
  });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("A valid symbol is required.", 422, request);
  const resolved = await resolveSupportedSymbol(parsed.data.symbol);
  if (!resolved) return jsonError("Symbol is outside the supported market universe.", 404, request);
  await enqueueMarketIntradayDemand(resolved.symbol, resolved.vendorSymbol);
  const snapshot = await getMarketIntradaySnapshot(resolved.vendorSymbol);
  const response: MarketIntradayResponse = snapshot
    ? { status: "ready", symbol: resolved.symbol, vendorSymbol: resolved.vendorSymbol, snapshot }
    : { status: "pending", symbol: resolved.symbol, vendorSymbol: resolved.vendorSymbol };
  return NextResponse.json(response, { status: snapshot ? 200 : 202, headers: corsHeaders(request) });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

async function resolveSupportedSymbol(input: string): Promise<MarketQuoteSnapshot | undefined> {
  const normalized = normalize(input);
  if (!normalized) return undefined;
  const market = await getMarketSnapshot();
  return [...market.indices, ...market.quotes].find((quote) =>
    quote.vendorSymbol.toUpperCase() === normalized.vendor || quote.symbol.toUpperCase() === normalized.display);
}

function normalize(input: string) {
  const cleaned = input.trim().toUpperCase().replace(/^(HK|HKG|SEHK)[.:]/, "").replace(/[.:](HK|HKG|SEHK)$/, "");
  if (!cleaned) return undefined;
  if (/^\d+$/.test(cleaned)) {
    const plain = cleaned.replace(/^0+(?=\d)/, "");
    return { display: plain.padStart(4, "0"), vendor: `${plain}.HK` };
  }
  return { display: cleaned, vendor: `${cleaned}.HK` };
}

function jsonError(message: string, status: number, request: Request) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders(request) });
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}
