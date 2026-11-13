import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { categoriesRepo } from "@/lib/db/categories-repo";
import { GET as list, POST as create } from "@/app/api/categories/route";
import { GET as get, PATCH as patch, DELETE as remove } from "@/app/api/categories/[id]/route";

vi.mock("@/lib/db/categories-repo", () => ({ categoriesRepo: {
  list: vi.fn(), create: vi.fn(), getById: vi.fn(), rename: vi.fn(), setEmoji: vi.fn(), delete: vi.fn(),
} }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const id = "11111111-1111-4111-8111-111111111111";
const category = { id, name: "Dinner", emoji: null, createdAt: "2026-10-20T00:00:00.000Z" };
const context = () => ({ params: Promise.resolve({ id }) });
async function req(method: string, body?: unknown, username: string | null = "test") {
  const token = username ? await createSessionToken(username) : "";
  return new Request("https://cookbook.example/api/categories", { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(categoriesRepo.list).mockResolvedValue([category]); vi.mocked(categoriesRepo.getById).mockResolvedValue(category);
  vi.mocked(categoriesRepo.create).mockResolvedValue(category); vi.mocked(categoriesRepo.rename).mockResolvedValue(category);
  vi.mocked(categoriesRepo.setEmoji).mockResolvedValue(category); vi.mocked(categoriesRepo.delete).mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("lets a recruiter list and read categories", async () => {
  expect(await (await list(await req("GET", undefined, "recruiter"))).json()).toEqual([category]);
  expect((await get(await req("GET", undefined, "recruiter"), context())).status).toBe(200);
});
it("creates a category with Location and no id override", async () => {
  const response = await create(await req("POST", { name: "Dinner", emoji: null }));
  expect(response.status).toBe(201); expect(response.headers.get("location")).toBe(`/api/categories/${id}`);
  expect(categoriesRepo.create).toHaveBeenCalledExactlyOnceWith({ name: "Dinner", emoji: null });
});
it("passes a name-and-emoji PATCH to one atomic repository operation", async () => {
  expect((await patch(await req("PATCH", { name: "Lunch", emoji: null }), context())).status).toBe(200);
  expect(categoriesRepo.rename).toHaveBeenCalledExactlyOnceWith(id, "Lunch", { emoji: null });
  expect(categoriesRepo.setEmoji).not.toHaveBeenCalled();
});
it("supports a name-only patch without changing emoji", async () => {
  await patch(await req("PATCH", { name: "Lunch" }), context());
  expect(categoriesRepo.rename).toHaveBeenCalledWith(id, "Lunch", {});
});
it("supports emoji-only and null emoji", async () => {
  await patch(await req("PATCH", { emoji: "L" }), context());
  await patch(await req("PATCH", { emoji: null }), context());
  expect(categoriesRepo.setEmoji).toHaveBeenNthCalledWith(1, id, "L");
  expect(categoriesRepo.setEmoji).toHaveBeenNthCalledWith(2, id, null);
  expect(categoriesRepo.rename).not.toHaveBeenCalled();
});
it.each([{}, { name: " " }, { id }, { emoji: 1 }])("rejects invalid category patch %s", async (body) => {
  expect((await patch(await req("PATCH", body), context())).status).toBe(400);
  expect(categoriesRepo.rename).not.toHaveBeenCalled(); expect(categoriesRepo.setEmoji).not.toHaveBeenCalled();
});
it("deletes with 204", async () => {
  const response = await remove(await req("DELETE"), context());
  expect(response.status).toBe(204); expect(await response.text()).toBe("");
  expect(categoriesRepo.delete).toHaveBeenCalledWith(id);
});
it.each(["anonymous", "recruiter"])("blocks all category writes for %s", async (actor) => {
  const username = actor === "anonymous" ? null : actor;
  const status = username ? 403 : 401;
  expect((await create(await req("POST", { name: "Dinner", emoji: null }, username))).status).toBe(status);
  expect((await patch(await req("PATCH", { emoji: null }, username), context())).status).toBe(status);
  expect((await remove(await req("DELETE", undefined, username), context())).status).toBe(status);
  for (const method of [categoriesRepo.create, categoriesRepo.rename, categoriesRepo.setEmoji, categoriesRepo.delete]) expect(method).not.toHaveBeenCalled();
});
it("requires a viewer for both category reads", async () => {
  expect((await list(await req("GET", undefined, null))).status).toBe(401);
  expect((await get(await req("GET", undefined, null), context())).status).toBe(401);
});
it("maps missing and conflicting categories", async () => {
  vi.mocked(categoriesRepo.getById).mockRejectedValue(new NotFoundError("Category not found"));
  expect((await get(await req("GET"), context())).status).toBe(404);
  vi.mocked(categoriesRepo.rename).mockRejectedValue(new ConflictError("Name exists"));
  expect((await patch(await req("PATCH", { name: "Lunch", emoji: "L" }), context())).status).toBe(409);
  expect(categoriesRepo.setEmoji).not.toHaveBeenCalled();
});
