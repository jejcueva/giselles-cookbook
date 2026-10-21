export type Ingredient = { name: string; amount: string; unit: string };
export type InstructionStep = { stepNumber: number; text: string };
export type RecipePhoto = { key: string; sortOrder: number };

export type Recipe = {
  id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  notes: string | null;
  sourceUrl: string | null;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isFavorite: boolean;
  categoryIds: string[];
  tags: string[];
  photos: RecipePhoto[];
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeSummary = Pick<Recipe,
  "id" | "title" | "coverImage" | "isFavorite" | "categoryIds" | "createdAt"
>;
export type Category = { id: string; name: string; emoji: string | null; createdAt: string };
export type CreateRecipeInput = Omit<Recipe, "id" | "createdAt" | "updatedAt">;
export type RecipePatch = Partial<CreateRecipeInput>;
export type RecipeOverrides = Partial<Pick<Recipe, "id" | "createdAt" | "updatedAt">>;
export type CreateCategoryInput = Pick<Category, "name" | "emoji">;
