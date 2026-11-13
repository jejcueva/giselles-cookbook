import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth-session";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { consumeApiLimit } from "@/lib/api-rate-limit";
import { handleRoute, json, readJson, requireOwner, requireViewer, RouteError } from "@/lib/api-route";

vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(consumeApiLimit).mockReturnValue({ allowed: true, retryAfter: 0 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function request(username = "test", method = "GET", body?: string, origin = "https://cookbook.example") {
  const token = await createSessionToken(username);
  return new Request("https://cookbook.example/api/recipes", { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin, "content-type": "application/json" }, body });
}

it.each(["test", "gisellemyluv", "recruiter"])("accepts a verified %s viewer", async (username) => {
  expect((await requireViewer(await request(username))).username).toBe(username);
});
it.each([undefined, "bad", "a.b.c", "a.%%%", "x".repeat(5000)])("rejects missing or malformed token %s", async (token) => {
  const req = new Request("https://cookbook.example/api/recipes", { headers: token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {} });
  const response = await handleRoute(req, async () => { await requireViewer(req); return json({}); });
  expect(response.status).toBe(401);
});
it("does not turn production secret misconfiguration into unauthenticated", async () => {
  const req = await request();
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("AUTH_SESSION_SECRET", "");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await handleRoute(req, async () => { await requireViewer(req); return json({}); });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Internal server error" });
  expect(log).toHaveBeenCalled();
});
it("rejects expired and tampered signed cookies", async () => {
  const expired = await request();
  vi.useFakeTimers();
  try {
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect((await handleRoute(expired, async () => { await requireViewer(expired); return json({}); })).status).toBe(401);
  } finally { vi.useRealTimers(); }
  const tampered = await request();
  const cookie = tampered.headers.get("cookie")!;
  tampered.headers.set("cookie", `${cookie.slice(0, cookie.lastIndexOf("."))}.AA`);
  expect((await handleRoute(tampered, async () => { await requireViewer(tampered); return json({}); })).status).toBe(401);
});
it.each(["POST", "PATCH", "DELETE"])("rejects recruiter %s before reading a body", async (method) => {
  const req = await request("recruiter", method);
  const response = await handleRoute(req, async () => { await requireOwner(req); return json({}); });
  expect(response.status).toBe(403);
  expect(req.bodyUsed).toBe(false);
});
it.each(["https://evil.example", "null", ""])("rejects a write Origin of %s", async (origin) => {
  const req = await request("test", "POST", "{}", origin);
  const response = await handleRoute(req, async () => { await requireOwner(req); return json({}); });
  expect(response.status).toBe(403);
});
it("keeps a POST body readable after the owner guard", async () => {
  const req = await request("test", "POST", '{"title":"Soup"}');
  await requireOwner(req);
  expect(req.bodyUsed).toBe(false);
  expect(await readJson(req)).toEqual({ title: "Soup" });
});
it("maps invalid JSON to 400 without hiding unrelated SyntaxErrors", async () => {
  const req = await request("test", "POST", "{");
  expect((await handleRoute(req, async () => json(await readJson(req)))).status).toBe(400);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const error = await handleRoute(await request(), async () => { throw new SyntaxError("Repository defect"); });
  expect(error.status).toBe(500);
});
it("rejects wrong media type and empty JSON", async () => {
  const wrongType = new Request("https://cookbook.example/api/recipes", { method: "POST", body: "{}" });
  await expect(readJson(wrongType)).rejects.toMatchObject({ status: 400 });
  await expect(readJson(await request("test", "POST"))).rejects.toMatchObject({ status: 400 });
});
it("limits actual streamed bytes without trusting Content-Length", async () => {
  const req = new Request("https://cookbook.example/api/recipes", {
    method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(256 * 1024 + 1),
  });
  await expect(readJson(req)).rejects.toMatchObject({ status: 400 });
});
it.each([
  [new NotFoundError("Recipe not found"), 404, "Recipe not found"],
  [new ConflictError("Name exists"), 409, "Name exists"],
  [new RouteError(403, "Forbidden"), 403, "Forbidden"],
])("maps a typed error: %s", async (error, status, message) => {
  const response = await handleRoute(await request(), async () => { throw error; });
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: message });
});
it("maps Zod errors to 400 and never returns internal messages", async () => {
  const invalid = await handleRoute(await request(), async () => { z.string().parse(1); return json({}); });
  expect(invalid.status).toBe(400);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const internal = await handleRoute(await request(), async () => { throw new Error("secret-internal-detail"); });
  expect(await internal.json()).toEqual({ error: "Internal server error" });
});
it("sets no-store on success and bodyless deletes", async () => {
  const response = await handleRoute(await request(), async () => json({ ok: true }, 201, { Location: "/api/recipes/x" }));
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("location")).toBe("/api/recipes/x");
  const deleted = await handleRoute(await request(), async () => new Response(null, { status: 204 }));
  expect(await deleted.text()).toBe("");
  expect(deleted.headers.get("cache-control")).toBe("no-store");
});
it("returns 429 and Retry-After before running an operation", async () => {
  vi.mocked(consumeApiLimit).mockReturnValue({ allowed: false, retryAfter: 12 });
  const operation = vi.fn();
  const response = await handleRoute(await request(), operation);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("12");
  expect(operation).not.toHaveBeenCalled();
});
