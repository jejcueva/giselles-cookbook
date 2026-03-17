// bucket is public — public urls never expire, just pass through
export async function resolveCoverImageUrl(inputUrl: string | null): Promise<string | null> {
  return inputUrl;
}
