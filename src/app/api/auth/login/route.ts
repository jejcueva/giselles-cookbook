import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth-session";
import { validateCredentials } from "@/lib/server-auth";
import {
  clearAuthAttempts,
  isAuthRateLimited,
  recordFailedAuthAttempt,
} from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limitKey = `auth:${sourceIp}`;
  if (isAuthRateLimited(limitKey)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string; mode?: "verify" | "login" }
    | null;

  const username = validateCredentials(body?.username ?? "", body?.password ?? "");
  if (!username) {
    recordFailedAuthAttempt(limitKey);
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  clearAuthAttempts(limitKey);

  if (body?.mode === "verify") {
    return NextResponse.json({ ok: true, username });
  }

  const rawPassword = body?.password ?? "";
  if (!rawPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}

