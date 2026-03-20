import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, clearSessionCookieOptions } from "@/lib/auth-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", clearSessionCookieOptions());
  return response;
}

