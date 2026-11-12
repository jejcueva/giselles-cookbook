import { handleRoute, json, readJson, requireOwner, requireViewer } from "@/lib/api-route";
import { categoryCreateSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    return json(await categoriesRepo.list());
  });
}
export async function POST(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const body = categoryCreateSchema.parse(await readJson(request));
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    const category = await categoriesRepo.create(body);
    return json(category, 201, { Location: `/api/categories/${category.id}` });
  });
}
