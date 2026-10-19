const PUBLIC_ROUTES = new Set(["/login"]);

/** Pages reachable without a session. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

/** Paths the auth middleware must never touch (auth endpoints, health check, framework assets). */
export function isBypassedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  );
}
