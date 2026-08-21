import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function runnerAuthorized(request: Request) {
  const expected = process.env.RUNNER_TOKEN || "dev-runner-token";
  return request.headers.get("authorization") === `Bearer ${expected}`;
}
