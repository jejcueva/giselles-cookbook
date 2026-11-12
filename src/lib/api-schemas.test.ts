import { expect, expectTypeOf, it } from "vitest";
import type { CreateRecipeInput, RecipePatch } from "@/lib/types";
import { categoryCreateSchema, categoryPatchSchema, favoriteSchema, idSchema, recipeCreateSchema, recipePatchSchema, recipeQuerySchema, uploadSchema } from "@/lib/api-schemas";

const id = "11111111-1111-4111-8111-111111111111";
const recipe: CreateRecipeInput = {
  title: " Soup ", ingredients: [{ name: "Water", amount: "", unit: "" }],
  instructions: [{ stepNumber: 1, text: "Boil" }], notes: null, sourceUrl: "http://blog.example/soup",
  cookTime: null, prepTime: 0, servings: 1, calories: null, protein: 1.5, carbs: 2.5, fat: 0,
  isFavorite: false, categoryIds: [id], tags: ["easy"], photos: [], coverImage: null,
};
it("outputs the Phase 2 shapes and preserves nullable and fractional values", () => {
  expectTypeOf(recipeCreateSchema.parse(recipe)).toEqualTypeOf<CreateRecipeInput>();
  expectTypeOf(recipePatchSchema.parse({ title: "Soup" })).toEqualTypeOf<RecipePatch>();
  expect(recipeCreateSchema.parse(recipe)).toMatchObject({ title: "Soup", protein: 1.5, notes: null });
});
it.each(["id", "createdAt", "updatedAt", "PK", "SK", "GSI1PK"])("rejects injected %s", (field) => {
  expect(recipeCreateSchema.safeParse({ ...recipe, [field]: id }).success).toBe(false);
});
it.each([
  { title: " " }, { ingredients: [{ name: "Water", amount: 1, unit: "cup" }] },
  { instructions: [{ step_number: 1, text: "Boil" }] }, { cookTime: -1 },
  { servings: 0 }, { protein: Infinity }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "not-a-url" },
  { photos: [{ key: "photos/x/a.png", sortOrder: 0, id: "injected" }] },
])("rejects invalid recipe fields: %s", (patch) => {
  expect(recipeCreateSchema.safeParse({ ...recipe, ...patch }).success).toBe(false);
});
it("requires a nonempty partial patch without create defaults", () => {
  expect(recipePatchSchema.safeParse({}).success).toBe(false);
  expect(recipePatchSchema.parse({ notes: null })).toEqual({ notes: null });
});
it("accepts new cover keys and external HTTPS, but rejects unsafe image values", () => {
  expect(recipePatchSchema.parse({ coverImage: `covers/${id}.png` }).coverImage).toBe(`covers/${id}.png`);
  expect(recipePatchSchema.parse({ coverImage: "https://blog.example/a.jpg" }).coverImage).toContain("https://");
  for (const coverImage of ["http://blog.example/a.jpg", "covers/../private.png", "arbitrary/key", "data:image/png,x"]) {
    expect(recipePatchSchema.safeParse({ coverImage }).success).toBe(false);
  }
});
it("validates category creation and combined nullable patches", () => {
  expect(categoryCreateSchema.parse({ name: " Dinner ", emoji: null })).toEqual({ name: "Dinner", emoji: null });
  expect(categoryPatchSchema.parse({ name: "Lunch", emoji: null })).toEqual({ name: "Lunch", emoji: null });
  expect(categoryPatchSchema.safeParse({}).success).toBe(false);
  expect(categoryPatchSchema.safeParse({ name: " " }).success).toBe(false);
});
it("does not coerce a favorite string into a boolean", () => {
  expect(favoriteSchema.parse({ value: false })).toEqual({ value: false });
  expect(favoriteSchema.safeParse({ value: "true" }).success).toBe(false);
});
it("validates UUID params and explicit recipe query filters", () => {
  expect(idSchema.parse(id)).toBe(id);
  expect(idSchema.safeParse("RECIPE#x").success).toBe(false);
  expect(recipeQuerySchema.parse({ favorite: "1", category: id })).toEqual({ favorite: "1", category: id });
  expect(recipeQuerySchema.safeParse({ favorite: "0" }).success).toBe(false);
  expect(recipeQuerySchema.safeParse({ unexpected: "1" }).success).toBe(false);
});
it.each(["image/jpeg", "image/png", "image/webp", "image/heic"])("allows upload MIME %s", (contentType) => {
  expect(uploadSchema.parse({ fileName: "a", contentType, size: 10 * 1024 * 1024 }).size).toBe(10 * 1024 * 1024);
});
it.each([
  { fileName: " " }, { contentType: "image/gif" }, { size: 0 }, { size: -1 },
  { size: 1.5 }, { size: 10 * 1024 * 1024 + 1 },
])("rejects invalid upload metadata: %s", (patch) => {
  expect(uploadSchema.safeParse({ fileName: "x", contentType: "image/png", size: 1, ...patch }).success).toBe(false);
});
