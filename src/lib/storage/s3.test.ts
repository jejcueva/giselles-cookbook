import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteObject, presignUpload, toPublicUrl } from "@/lib/storage/s3";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", bucketName: "test-images", imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
const s3 = mockClient(S3Client);
beforeEach(() => {
  s3.reset();
  vi.mocked(getSignedUrl).mockReset().mockResolvedValue("https://signed.example/put");
});
afterEach(() => vi.restoreAllMocks());

describe("presignUpload", () => {
  it.each([
    ["image/jpeg", "jpg"], ["image/png", "png"],
    ["image/webp", "webp"], ["image/heic", "heic"],
  ])("signs %s with a MIME-derived extension", async (contentType, ext) => {
    const result = await presignUpload({ fileName: "untrusted.exe", contentType, size: 123 });
    expect(result.key).toMatch(new RegExp(`^covers/[0-9a-f-]{36}\\.${ext}$`));
    expect(result.uploadUrl).toBe("https://signed.example/put");
    const [client, command, options] = vi.mocked(getSignedUrl).mock.calls[0];
    expect(client).toBeInstanceOf(S3Client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: "test-images", Key: result.key, ContentType: contentType, ContentLength: 123,
    });
    expect(options).toEqual({ expiresIn: 300 });
  });
  it.each(["image/gif", "text/plain", "IMAGE/JPEG"])("rejects %s before signing", async (contentType) => {
    await expect(presignUpload({ fileName: "x", contentType, size: 1 })).rejects.toThrow("content type");
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it.each([0, -1, 0.5, NaN, Infinity, 10 * 1024 * 1024 + 1])("rejects size %s", async (size) => {
    await expect(presignUpload({ fileName: "x", contentType: "image/png", size })).rejects.toThrow("size");
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it("rejects an empty file name", async () => {
    await expect(presignUpload({ fileName: " ", contentType: "image/png", size: 1 })).rejects.toThrow("file name");
  });
  it("accepts exactly 10 MiB", async () => {
    await expect(presignUpload({ fileName: "x", contentType: "image/png", size: 10 * 1024 * 1024 }))
      .resolves.toHaveProperty("key");
  });
});

describe("toPublicUrl", () => {
  it.each([
    ["covers/a.png", "https://d2gmo95al03pdi.cloudfront.net/covers/a.png"],
    ["https://blog.example/photo.jpg", "https://blog.example/photo.jpg"],
  ])("resolves %s", (input, expected) => expect(toPublicUrl(input)).toBe(expected));
});

describe("deleteObject", () => {
  it("deletes a stored key", async () => {
    s3.on(DeleteObjectCommand).resolves({});
    await deleteObject("covers/old.png");
    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input)
      .toEqual({ Bucket: "test-images", Key: "covers/old.png" });
  });
  it("logs failure without rejecting", async () => {
    s3.on(DeleteObjectCommand).rejects(new Error("S3 unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deleteObject("covers/old.png")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Could not delete S3 object", expect.objectContaining({ key: "covers/old.png" }));
  });
  it("does not try to delete an external URL", async () => {
    await deleteObject("https://blog.example/photo.jpg");
    expect(s3.calls()).toHaveLength(0);
  });
});
