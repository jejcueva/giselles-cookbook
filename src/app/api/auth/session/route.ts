import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME)?.value ?? "";
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    username: session.username,
    role: session.role,
  });
}
