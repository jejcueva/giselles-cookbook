import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/config";

const s3 = new S3Client({ region: config.region, credentials: config.credentials });
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
};
type UploadInput = { fileName: string; contentType: string; size: number };

export async function presignUpload(input: UploadInput): Promise<{ key: string; uploadUrl: string }> {
  if (typeof input.fileName !== "string" || !input.fileName.trim()) {
    throw new Error("Invalid file name");
  }
  const ext = Object.hasOwn(extensions, input.contentType) ? extensions[input.contentType] : undefined;
  if (!ext) throw new Error("Unsupported image content type");
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > 10 * 1024 * 1024) {
    throw new Error("Invalid image size (maximum 10 MiB)");
  }
  const key = `covers/${randomUUID()}.${ext}`;
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: config.bucketName, Key: key, ContentType: input.contentType, ContentLength: input.size,
  }), { expiresIn: 300 });
  return { key, uploadUrl };
}

export function toPublicUrl(keyOrUrl: string): string {
  return keyOrUrl.startsWith("https://") ? keyOrUrl : `https://${config.imageCdnHost}/${keyOrUrl}`;
}

export async function deleteObject(key: string): Promise<void> {
  if (key.startsWith("https://")) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
  } catch (error) {
    console.error("Could not delete S3 object", { key, error });
  }
}
