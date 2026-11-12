import { handleRoute, json, readJson, requireOwner, requireViewer } from "@/lib/api-route";
import { idSchema, recipePatchSchema } from "@/lib/api-schemas";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const id = idSchema.parse((await context.params).id);
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    return json(await recipesRepo.getById(id));
  });
}
export async function PATCH(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const body = recipePatchSchema.parse(await readJson(request));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    let patch = body;
    if (body.coverImage !== undefined) {
      const current = await recipesRepo.getById(id);
      if (body.coverImage === current.coverImage) {
        const { coverImage, ...unchangedCoverOmitted } = body;
        void coverImage;
        patch = unchangedCoverOmitted;
      }
    }
    return json(await recipesRepo.update(id, patch));
  });
}
export async function DELETE(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    await recipesRepo.delete(id);
    return new Response(null, { status: 204 });
  });
}
