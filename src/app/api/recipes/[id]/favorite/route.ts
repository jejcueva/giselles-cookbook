import { handleRoute, json, readJson, requireOwner } from "@/lib/api-route";
import { favoriteSchema, idSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const { value } = favoriteSchema.parse(await readJson(request));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    return json(await recipesRepo.setFavorite(id, value));
  });
}
