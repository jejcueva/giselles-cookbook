import { handleRoute, json, readJson, requireOwner } from "@/lib/api-route";
import { uploadSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const body = uploadSchema.parse(await readJson(request));
    const { presignUpload } = await import("@/lib/storage/s3");
    return json(await presignUpload(body));
  });
}
