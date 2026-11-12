import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CreateRecipeInput, Recipe } from "@/lib/types";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { recipesRepo } from "@/lib/db/recipes-repo";
import { GET as list, POST as create } from "@/app/api/recipes/route";
import { GET as get, PATCH as update, DELETE as remove } from "@/app/api/recipes/[id]/route";
import { POST as favorite } from "@/app/api/recipes/[id]/favorite/route";

vi.mock("@/lib/db/recipes-repo", () => ({ recipesRepo: {
  list: vi.fn(), create: vi.fn(), getById: vi.fn(), update: vi.fn(), delete: vi.fn(), setFavorite: vi.fn(),
} }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const id = "11111111-1111-4111-8111-111111111111";
const input: CreateRecipeInput = {
  title: "Soup", ingredients: [], instructions: [], notes: null, sourceUrl: null,
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: false, categoryIds: [], tags: [], photos: [], coverImage: null,
};
const recipe: Recipe = { ...input, id, createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" };
const context = () => ({ params: Promise.resolve({ id }) });
async function req(method: string, body?: unknown, username: string | null = "test", query = "") {
  const token = username ? await createSessionToken(username) : "";
  return new Request(`https://cookbook.example/api/recipes${query}`, { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(recipesRepo.list).mockResolvedValue([]); vi.mocked(recipesRepo.create).mockResolvedValue(recipe);
  vi.mocked(recipesRepo.getById).mockResolvedValue(recipe); vi.mocked(recipesRepo.update).mockResolvedValue(recipe);
  vi.mocked(recipesRepo.delete).mockResolvedValue(undefined); vi.mocked(recipesRepo.setFavorite).mockResolvedValue(recipe);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("lets a recruiter list with the exact repository filters", async () => {
  const response = await list(await req("GET", undefined, "recruiter", `?favorite=1&category=${id}`));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
  expect(recipesRepo.list).toHaveBeenCalledWith({ favorite: true, categoryId: id });
});
it("lists without filters", async () => {
  expect((await list(await req("GET"))).status).toBe(200);
  expect(recipesRepo.list).toHaveBeenCalledWith({ favorite: undefined, categoryId: undefined });
});
it.each(["?favorite=0", "?category=bad", "?favorite=1&favorite=1", "?extra=1"])("rejects query %s", async (query) => {
  expect((await list(await req("GET", undefined, "test", query))).status).toBe(400);
  expect(recipesRepo.list).not.toHaveBeenCalled();
});
it("creates with 201 and no migration overrides", async () => {
  const response = await create(await req("POST", input));
  expect(response.status).toBe(201);
  expect(response.headers.get("location")).toBe(`/api/recipes/${id}`);
  expect(await response.json()).toEqual(recipe);
  expect(recipesRepo.create).toHaveBeenCalledExactlyOnceWith(input);
});
it("rejects injected create metadata", async () => {
  expect((await create(await req("POST", { ...input, id }))).status).toBe(400);
  expect(recipesRepo.create).not.toHaveBeenCalled();
});
it("allows recruiter detail reads with async params", async () => {
  expect((await get(await req("GET", undefined, "recruiter"), context())).status).toBe(200);
  expect(recipesRepo.getById).toHaveBeenCalledWith(id);
});
it("rejects invalid resource ids before repository access", async () => {
  expect((await get(await req("GET"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(recipesRepo.getById).not.toHaveBeenCalled();
});
it("passes only the supplied PATCH fields", async () => {
  expect((await update(await req("PATCH", { notes: null }), context())).status).toBe(200);
  expect(recipesRepo.update).toHaveBeenCalledWith(id, { notes: null });
});
it("does not replace an unchanged public cover URL with itself", async () => {
  const coverImage = "https://d2gmo95al03pdi.cloudfront.net/covers/old.png";
  vi.mocked(recipesRepo.getById).mockResolvedValue({ ...recipe, coverImage });
  await update(await req("PATCH", { title: "Stew", coverImage }), context());
  expect(recipesRepo.update).toHaveBeenCalledWith(id, { title: "Stew" });
});
it("passes a new cover key and explicit favorite false", async () => {
  const coverImage = `covers/${id}.png`;
  expect((await update(await req("PATCH", { coverImage }), context())).status).toBe(200);
  expect(recipesRepo.update).toHaveBeenCalledWith(id, { coverImage });
  expect((await favorite(await req("POST", { value: false }), context())).status).toBe(200);
  expect(recipesRepo.setFavorite).toHaveBeenCalledWith(id, false);
});
it("rejects empty PATCH and invalid favorite payloads", async () => {
  expect((await update(await req("PATCH", {}), context())).status).toBe(400);
  expect((await favorite(await req("POST", { value: "true" }), context())).status).toBe(400);
  expect(recipesRepo.update).not.toHaveBeenCalled(); expect(recipesRepo.setFavorite).not.toHaveBeenCalled();
});
it("deletes with a bodyless 204", async () => {
  const response = await remove(await req("DELETE"), context());
  expect(response.status).toBe(204); expect(await response.text()).toBe("");
  expect(recipesRepo.delete).toHaveBeenCalledWith(id);
});
it.each(["anonymous", "recruiter"])("blocks every mutation for %s before repository calls", async (actor) => {
  const username = actor === "anonymous" ? null : actor;
  const expected = username ? 403 : 401;
  expect((await create(await req("POST", input, username))).status).toBe(expected);
  expect((await update(await req("PATCH", { title: "Stew" }, username), context())).status).toBe(expected);
  expect((await remove(await req("DELETE", undefined, username), context())).status).toBe(expected);
  expect((await favorite(await req("POST", { value: true }, username), context())).status).toBe(expected);
  for (const method of [recipesRepo.create, recipesRepo.update, recipesRepo.delete, recipesRepo.setFavorite]) expect(method).not.toHaveBeenCalled();
});
it("rejects anonymous reads", async () => {
  expect((await list(await req("GET", undefined, null))).status).toBe(401);
  expect((await get(await req("GET", undefined, null), context())).status).toBe(401);
});
it("maps typed repository failures and hides unexpected errors", async () => {
  vi.mocked(recipesRepo.getById).mockRejectedValue(new NotFoundError("Recipe not found"));
  expect((await get(await req("GET"), context())).status).toBe(404);
  vi.mocked(recipesRepo.update).mockRejectedValue(new ConflictError("Conflict"));
  expect((await update(await req("PATCH", { title: "Stew" }), context())).status).toBe(409);
  vi.mocked(recipesRepo.list).mockRejectedValue(new Error("internal-secret"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await list(await req("GET"));
  expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Internal server error" });
});
