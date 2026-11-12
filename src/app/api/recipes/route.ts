import { handleRoute, json, readJson, requireOwner, requireViewer, RouteError } from "@/lib/api-route";
import { recipeCreateSchema, recipeQuerySchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const search = new URL(request.url).searchParams;
    for (const key of search.keys()) if (search.getAll(key).length !== 1) throw new RouteError(400, "Duplicate query parameter");
    const query = recipeQuerySchema.parse(Object.fromEntries(search));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    return json(await recipesRepo.list({ favorite: query.favorite === "1" ? true : undefined, categoryId: query.category }));
  });
}
export async function POST(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const body = recipeCreateSchema.parse(await readJson(request));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    const recipe = await recipesRepo.create(body);
    return json(recipe, 201, { Location: `/api/recipes/${recipe.id}` });
  });
}
