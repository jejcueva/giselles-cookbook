import { handleRoute, json, readJson, requireOwner, requireViewer } from "@/lib/api-route";
import { categoryPatchSchema, idSchema } from "@/lib/api-schemas";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const id = idSchema.parse((await context.params).id);
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    return json(await categoriesRepo.getById(id));
  });
}
export async function PATCH(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const body = categoryPatchSchema.parse(await readJson(request));
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    if (body.name !== undefined) {
      return json(await categoriesRepo.rename(id, body.name, body.emoji !== undefined ? { emoji: body.emoji } : {}));
    }
    return json(await categoriesRepo.setEmoji(id, body.emoji ?? null));
  });
}
export async function DELETE(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    await categoriesRepo.delete(id);
    return new Response(null, { status: 204 });
  });
}
