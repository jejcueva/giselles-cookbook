import { handleRoute, json } from "@/lib/api-route";
import { idSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleRoute(request, async () => {
    const id = idSchema.parse((await context.params).id);
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    const recipe = await recipesRepo.getById(id);
    const { title, coverImage, ingredients, instructions, notes, cookTime, prepTime, servings, calories, protein, carbs, fat } = recipe;
    return json({ id, title, coverImage, ingredients, instructions, notes, cookTime, prepTime, servings, calories, protein, carbs, fat });
  });
}
