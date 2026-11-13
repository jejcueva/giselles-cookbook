import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { presignUpload } from "@/lib/storage/s3";
import { POST } from "@/app/api/uploads/presign/route";

vi.mock("@/lib/storage/s3", () => ({ presignUpload: vi.fn() }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const body = { fileName: "a.png", contentType: "image/png", size: 123 };
async function req(username: string | null, input: unknown = body) {
  const token = username ? await createSessionToken(username) : "";
  return new Request("https://cookbook.example/api/uploads/presign", { method: "POST",
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" }, body: JSON.stringify(input) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(presignUpload).mockResolvedValue({ key: "covers/test.png", uploadUrl: "https://signed.example/put" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("signs only after owner authorization and validation", async () => {
  const response = await POST(await req("test"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ key: "covers/test.png", uploadUrl: "https://signed.example/put" });
  expect(presignUpload).toHaveBeenCalledExactlyOnceWith(body);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each([null, "recruiter"])("rejects signer %s", async (username) => {
  expect((await POST(await req(username))).status).toBe(username ? 403 : 401);
  expect(presignUpload).not.toHaveBeenCalled();
});
it.each([{ size: 10 * 1024 * 1024 + 1 }, { contentType: "image/gif" }, { key: "forged" }])("rejects invalid upload %s", async (patch) => {
  expect((await POST(await req("test", { ...body, ...patch }))).status).toBe(400);
  expect(presignUpload).not.toHaveBeenCalled();
});
it("hides signing failures", async () => {
  vi.mocked(presignUpload).mockRejectedValue(new Error("AWS secret detail"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await POST(await req("test"));
  expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Internal server error" });
});
