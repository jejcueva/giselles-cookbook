import { describe, expect, it } from "vitest";
import { isBypassedPath, isPublicPath } from "@/lib/route-access";

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it.each(["/", "/recipes", "/login/extra", "/api/recipes"])("treats %s as protected", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("isBypassedPath", () => {
  it.each([
    "/api/auth/login",
    "/api/auth/session",
    "/api/health",
    "/_next/static/chunk.js",
    "/_next/image?url=x",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ])("bypasses auth for %s", (pathname) => {
    expect(isBypassedPath(pathname)).toBe(true);
  });

  it.each(["/", "/recipes", "/api/recipes", "/api/healthz", "/api/health/extra", "/api/chat"])(
    "does not bypass auth for %s",
    (pathname) => {
      expect(isBypassedPath(pathname)).toBe(false);
    }
  );
});
