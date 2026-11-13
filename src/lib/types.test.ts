import { expectTypeOf, it } from "vitest";
import type { Category, Ingredient, InstructionStep, Recipe, RecipePhoto, RecipeSummary } from "@/lib/types";

it("keeps the existing value types with the design's field names", () => {
  expectTypeOf<Ingredient>().toEqualTypeOf<{ name: string; amount: string; unit: string }>();
  expectTypeOf<InstructionStep>().toEqualTypeOf<{ stepNumber: number; text: string }>();
  expectTypeOf<RecipePhoto>().toEqualTypeOf<{ key: string; sortOrder: number }>();
  expectTypeOf<Category>().toEqualTypeOf<{ id: string; name: string; emoji: string | null; createdAt: string }>();
  expectTypeOf<Recipe["cookTime"]>().toEqualTypeOf<number | null>();
  expectTypeOf<Recipe["coverImage"]>().toEqualTypeOf<string | null>();
  expectTypeOf<RecipeSummary>().toEqualTypeOf<Pick<Recipe,
    "id" | "title" | "coverImage" | "isFavorite" | "categoryIds" | "createdAt"
  >>();
});
