import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { isRecruiterBlockedPath } from "@/lib/auth-roles";

const PUBLIC_ROUTES = new Set(["/login"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

function isBypassedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  const session = token ? await verifySessionToken(token) : null;

  if (!session && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session?.role === "recruiter" && isRecruiterBlockedPath(pathname)) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  if (session && pathname === "/login") {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"],
};

