import { describe, expect, it } from "vitest";
import { isBypassedPath, isPublicPath } from "@/lib/route-access";

describe("isPublicPath", () => {
  it("treats /login as public", () => expect(isPublicPath("/login")).toBe(true));
  it.each(["/", "/recipes", "/login/extra", "/api/recipes"])("keeps %s protected", (path) => expect(isPublicPath(path)).toBe(false));
});
describe("isBypassedPath", () => {
  it.each([
    "/api/auth", "/api/auth/login", "/api/auth/session", "/api/health",
    "/_next/static/chunk.js", "/_next/image?url=x", "/favicon.ico", "/robots.txt", "/sitemap.xml",
    "/api/recipes", "/api/recipes/id", "/api/recipes/id/favorite",
    "/api/categories", "/api/categories/id", "/api/uploads/presign", "/api/share/id",
  ])("delegates %s to its own handler", (path) => expect(isBypassedPath(path)).toBe(true));
  it.each([
    "/", "/recipes", "/api/chat", "/api/healthz", "/api/health/extra",
    "/robots.txt/extra", "/sitemap.xml/extra", "/api/auth-other", "/api/recipes-other",
    "/api/recipes/id/extra", "/api/categories/id/extra", "/api/uploads/presign/extra",
    "/api/share-other/id", "/api/share/id/extra",
  ])("does not bypass %s", (path) => expect(isBypassedPath(path)).toBe(false));
});
