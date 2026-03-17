import { supabase } from "@/lib/supabase";

const STORAGE_PUBLIC_MARKER = "/storage/v1/object/public/";

export async function resolveCoverImageUrl(inputUrl: string | null): Promise<string | null> {
  if (!inputUrl) return null;
  if (inputUrl.startsWith("blob:") || inputUrl.startsWith("data:")) return inputUrl;

  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    return inputUrl;
  }

  const markerIndex = url.pathname.indexOf(STORAGE_PUBLIC_MARKER);
  if (markerIndex === -1) {
    return inputUrl;
  }

  const afterMarker = url.pathname.slice(markerIndex + STORAGE_PUBLIC_MARKER.length);
  const [bucket, ...pathParts] = afterMarker.split("/").filter(Boolean);
  const objectPath = pathParts.join("/");
  if (!bucket || !objectPath) {
    return inputUrl;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) {
    return inputUrl;
  }

  return data.signedUrl;
}

