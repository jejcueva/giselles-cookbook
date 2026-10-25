export type AppConfig = {
  region: string;
  tableName: string;
  bucketName: string;
  imageCdnHost: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
};

const required = [
  "AWS_REGION", "TABLE_NAME", "BUCKET_NAME", "IMAGE_CDN_HOST",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
] as const;

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const missing = required.filter((key) => !env[key]?.trim());
  if (env.NODE_ENV === "production" && missing.length) {
    throw new Error(`Missing AWS configuration: ${missing.join(", ")}`);
  }
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
  }
  return {
    region: env.AWS_REGION?.trim() || "us-east-2",
    tableName: env.TABLE_NAME?.trim() || "cute-cookbook",
    bucketName: env.BUCKET_NAME?.trim() || "cutecookbookdata-imagesbucket1e86afb2-lnm24xf2wzzn",
    imageCdnHost: env.IMAGE_CDN_HOST?.trim() || "d2gmo95al03pdi.cloudfront.net",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
}

export const config = readConfig();
