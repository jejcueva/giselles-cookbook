import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const complete = {
  NODE_ENV: "production", AWS_REGION: "us-east-2", TABLE_NAME: "cute-cookbook",
  BUCKET_NAME: "test-images", IMAGE_CDN_HOST: "d2gmo95al03pdi.cloudfront.net",
  AWS_ACCESS_KEY_ID: "test-key", AWS_SECRET_ACCESS_KEY: "test-secret",
};
beforeEach(() => {
  for (const key of ["AWS_REGION", "TABLE_NAME", "BUCKET_NAME", "IMAGE_CDN_HOST", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
    vi.stubEnv(key, "");
  }
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function load() {
  vi.stubEnv("NODE_ENV", "test");
  return import("@/lib/config");
}

describe("readConfig", () => {
  it.each([
    "AWS_REGION", "TABLE_NAME", "BUCKET_NAME", "IMAGE_CDN_HOST",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
  ])("rejects a missing production %s", async (field) => {
    const { readConfig } = await load();
    expect(() => readConfig({ ...complete, [field]: " " })).toThrow(field);
  });

  it("reads all six values without exposing credential values in errors", async () => {
    const { readConfig } = await load();
    expect(readConfig(complete)).toEqual({
      region: "us-east-2", tableName: "cute-cookbook", bucketName: "test-images",
      imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
      credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
    });
    expect(() => readConfig({ ...complete, TABLE_NAME: "" })).toThrow("TABLE_NAME");
  });

  it("allows tests to load without real keys", async () => {
    const { readConfig } = await load();
    expect(readConfig({ NODE_ENV: "test" }).credentials).toBeUndefined();
    expect(readConfig({ NODE_ENV: "test" }).region).toBe("us-east-2");
  });

  it("rejects half a credential pair in development", async () => {
    const { readConfig } = await load();
    expect(() => readConfig({ NODE_ENV: "development", AWS_ACCESS_KEY_ID: "test" }))
      .toThrow("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
  });

  it("fails at module initialization in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TABLE_NAME", "");
    await expect(import("@/lib/config")).rejects.toThrow("TABLE_NAME");
  });
});
