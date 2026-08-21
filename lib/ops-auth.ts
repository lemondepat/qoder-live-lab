import { cookies } from "next/headers";

const encoder = new TextEncoder();
const COOKIE_NAME = "qll_ops";

async function signature(value: string) {
  const secret = process.env.OPS_SESSION_SECRET || "qll-development-session-secret";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createOpsSession() {
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const value = `${expires}.${await signature(String(expires))}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60 });
}

export async function isOpsAuthenticated() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;
  const [expires, provided] = value.split(".");
  if (!expires || !provided || Number(expires) < Date.now()) return false;
  return provided === await signature(expires);
}
