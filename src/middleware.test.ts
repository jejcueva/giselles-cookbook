import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { recipesRepo } from "@/lib/db/recipes-repo";
import { middleware } from "@/middleware";
import { GET, POST } from "@/app/api/recipes/route";

vi.mock("@/lib/db/recipes-repo", () => ({ recipesRepo: { list: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret"); });
afterEach(() => vi.unstubAllEnvs());
async function req(path: string, username?: string, method = "GET") {
  const token = username ? await createSessionToken(username) : "";
  return new NextRequest(`https://cookbook.example${path}`, { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" },
    body: method === "POST" ? "{}" : undefined });
}
it("lets the handler return JSON 401 instead of a login redirect", async () => {
  const request = await req("/api/recipes");
  expect((await middleware(request)).headers.get("x-middleware-next")).toBe("1");
  const response = await GET(request);
  expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "Unauthorized" });
  expect(response.headers.get("location")).toBeNull();
  expect(recipesRepo.list).not.toHaveBeenCalled();
});
it("keeps a recruiter write forbidden after middleware delegation", async () => {
  const request = await req("/api/recipes", "recruiter", "POST");
  expect((await middleware(request)).headers.get("x-middleware-next")).toBe("1");
  expect((await POST(request)).status).toBe(403);
  expect(recipesRepo.create).not.toHaveBeenCalled();
});
it("bypasses public share even with a malformed cookie", async () => {
  const request = new NextRequest("https://cookbook.example/api/share/id", { headers: { cookie: `${AUTH_COOKIE_NAME}=a.%%%` } });
  expect((await middleware(request)).headers.get("x-middleware-next")).toBe("1");
});
it("does not bypass a sibling API path", async () => {
  expect((await middleware(await req("/api/recipes-other"))).headers.get("location")).toBe("https://cookbook.example/login");
});
it("keeps private-page login redirects", async () => {
  expect((await middleware(await req("/recipes"))).headers.get("location")).toBe("https://cookbook.example/login");
});
it("keeps recruiter edit-page redirects", async () => {
  expect((await middleware(await req("/recipes/new", "recruiter"))).headers.get("location")).toBe("https://cookbook.example/");
});
it("keeps signed-in login-page redirects", async () => {
  expect((await middleware(await req("/login", "test"))).headers.get("location")).toBe("https://cookbook.example/");
});
it("keeps owner page access", async () => {
  expect((await middleware(await req("/recipes", "test"))).headers.get("x-middleware-next")).toBe("1");
});
