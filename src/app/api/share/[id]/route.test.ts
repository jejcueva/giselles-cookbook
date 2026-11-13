import { beforeEach, expect, it, vi } from "vitest";
import type { Recipe } from "@/lib/types";
import { NotFoundError } from "@/lib/db/errors";
import { recipesRepo } from "@/lib/db/recipes-repo";
import { GET } from "@/app/api/share/[id]/route";

vi.mock("@/lib/db/recipes-repo", () => ({ recipesRepo: { getById: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const id = "11111111-1111-4111-8111-111111111111";
const recipe: Recipe = {
  id, title: "Soup", ingredients: [], instructions: [], notes: "Serve warm", sourceUrl: "https://blog.example",
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: true, categoryIds: [id], tags: ["private-tag"], photos: [{ key: "photos/private/a.png", sortOrder: 0 }],
  coverImage: "https://d2gmo95al03pdi.cloudfront.net/covers/a.png",
  createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z",
};
beforeEach(() => { vi.clearAllMocks(); vi.mocked(recipesRepo.getById).mockResolvedValue(recipe); });
it("returns an explicit public projection without a session", async () => {
  const response = await GET(new Request(`https://cookbook.example/api/share/${id}`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    id, title: "Soup", ingredients: [], instructions: [], notes: "Serve warm", coverImage: recipe.coverImage,
    cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rejects an invalid share id", async () => {
  expect((await GET(new Request("https://cookbook.example/api/share/bad"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(recipesRepo.getById).not.toHaveBeenCalled();
});
it("returns JSON 404 for a missing public recipe", async () => {
  vi.mocked(recipesRepo.getById).mockRejectedValue(new NotFoundError("Recipe not found"));
  const response = await GET(new Request(`https://cookbook.example/api/share/${id}`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Recipe not found" });
});
