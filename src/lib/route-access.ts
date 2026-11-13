const PUBLIC_ROUTES = new Set(["/login"]);
const HANDLER_OWNED_API = /^\/api\/(?:recipes(?:\/[^/]+(?:\/favorite)?)?|categories(?:\/[^/]+)?|uploads\/presign|share\/[^/]+)\/?$/;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

export function isBypassedPath(pathname: string): boolean {
  return (
    pathname === "/api/auth" || pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" || HANDLER_OWNED_API.test(pathname) ||
    pathname.startsWith("/_next/") || pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" || pathname === "/sitemap.xml"
  );
}
