import { NextRequest, NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

type JsonLdRecipe = {
  "@type"?: string | string[];
  "@graph"?: unknown[];
  name?: string;
  recipeIngredient?: unknown[];
  recipeInstructions?: unknown[];
  cookTime?: string;
  prepTime?: string;
  recipeYield?: string | number | null;
  nutrition?: {
    calories?: string | number | null;
    proteinContent?: string | number | null;
    carbohydrateContent?: string | number | null;
    fatContent?: string | number | null;
  } | null;
  image?:
    | string
    | { url?: string | null }
    | Array<string | { url?: string | null }>
    | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function hasRecipeType(value: unknown): value is JsonLdRecipe {
  if (!isRecord(value)) return false;
  const typeValue = value["@type"];
  return (
    typeValue === "Recipe" ||
    (Array.isArray(typeValue) && typeValue.includes("Recipe"))
  );
}

function findRecipeNode(parsed: unknown): JsonLdRecipe | null {
  if (hasRecipeType(parsed)) return parsed;

  if (isRecord(parsed) && Array.isArray(parsed["@graph"])) {
    const match = parsed["@graph"].find((item) => hasRecipeType(item));
    return match ?? null;
  }

  if (Array.isArray(parsed)) {
    const match = parsed.find((item) => hasRecipeType(item));
    return match ?? null;
  }

  return null;
}

function getImageUrl(image: JsonLdRecipe["image"]): string | null {
  if (!image) return null;

  if (typeof image === "string") return image;

  if (Array.isArray(image)) {
    for (const entry of image) {
      const url = getImageUrl(entry);
      if (url) return url;
    }
    return null;
  }

  if (isRecord(image) && typeof image.url === "string") {
    return image.url;
  }

  return null;
}

function parseDuration(iso?: string): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  return parseInt(match[1] || "0", 10) * 60 + parseInt(match[2] || "0", 10) || null;
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  const isInstagram = /instagram\.com/.test(url);

  if (isInstagram) {
    try {
      const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
      const oembedRes = await fetch(oembedUrl);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        const caption = oembedData.title || "";
        if (caption) {
          return NextResponse.json({ type: "text", text: caption });
        }
      }
    } catch {
      // oEmbed failed, fall through
    }

    return NextResponse.json({ type: "paste_fallback" });
  }

  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CuteCookbook/1.0)" },
    });

    if (!pageRes.ok) {
      return NextResponse.json({ error: "Could not fetch URL" }, { status: 400 });
    }

    const html = await pageRes.text();

    const jsonLdMatches = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        const content = match.replace(/<script[^>]*>|<\/script>/gi, "");
        try {
          const parsed: unknown = JSON.parse(content);
          const recipeNode = findRecipeNode(parsed);

          if (recipeNode) {
            const ingredientValues = Array.isArray(recipeNode.recipeIngredient)
              ? recipeNode.recipeIngredient.filter(
                  (ingredient): ingredient is string => typeof ingredient === "string"
                )
              : [];

            const instructionValues = Array.isArray(recipeNode.recipeInstructions)
              ? recipeNode.recipeInstructions
              : [];

            const recipe = {
              title: recipeNode.name || "",
              ingredients: ingredientValues.map((ingredient) => ({
                name: ingredient,
                amount: "",
                unit: "",
              })),
              instructions: instructionValues.map((step, index) => ({
                step_number: index + 1,
                text:
                  typeof step === "string"
                    ? step
                    : isRecord(step) && typeof step.text === "string"
                      ? step.text
                      : "",
              })),
              cook_time: parseDuration(recipeNode.cookTime),
              prep_time: parseDuration(recipeNode.prepTime),
              servings:
                recipeNode.recipeYield != null
                  ? parseInt(String(recipeNode.recipeYield), 10) || null
                  : null,
              calories: recipeNode.nutrition?.calories
                ? parseInt(String(recipeNode.nutrition.calories), 10) || null
                : null,
              protein: recipeNode.nutrition?.proteinContent
                ? parseFloat(String(recipeNode.nutrition.proteinContent)) || null
                : null,
              carbs: recipeNode.nutrition?.carbohydrateContent
                ? parseFloat(String(recipeNode.nutrition.carbohydrateContent)) || null
                : null,
              fat: recipeNode.nutrition?.fatContent
                ? parseFloat(String(recipeNode.nutrition.fatContent)) || null
                : null,
              cover_image_url: getImageUrl(recipeNode.image),
            };

            return NextResponse.json({ type: "recipe", recipe });
          }
        } catch {
          continue;
        }
      }
    }

    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);

    return NextResponse.json({ type: "text", text: textContent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
