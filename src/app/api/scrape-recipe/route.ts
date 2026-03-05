import { NextRequest, NextResponse } from "next/server";

type ScrapedRecipe = {
  title: string;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: string[];
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  imageUrl: string | null;
};

function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  return hours * 60 + minutes || null;
}

function parseNutritionValue(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseIngredient(raw: string): { name: string; amount: string; unit: string } {
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 3 && /^\d/.test(parts[0])) {
    return { amount: parts[0], unit: parts[1], name: parts.slice(2).join(" ") };
  }
  if (parts.length >= 2 && /^\d/.test(parts[0])) {
    return { amount: parts[0], unit: "", name: parts.slice(1).join(" ") };
  }
  return { amount: "", unit: "", name: raw.trim() };
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CuteCookbook/1.0)" },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 });
    }

    const html = await response.text();

    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let recipe: Record<string, unknown> | null = null;
    let match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        for (const candidate of candidates) {
          if (
            candidate["@type"] === "Recipe" ||
            (Array.isArray(candidate["@type"]) && candidate["@type"].includes("Recipe"))
          ) {
            recipe = candidate;
            break;
          }
          if (candidate["@graph"]) {
            for (const node of candidate["@graph"]) {
              if (
                node["@type"] === "Recipe" ||
                (Array.isArray(node["@type"]) && node["@type"].includes("Recipe"))
              ) {
                recipe = node;
                break;
              }
            }
          }
        }
        if (recipe) break;
      } catch {
        // skip malformed JSON-LD
      }
    }

    if (!recipe) {
      return NextResponse.json(
        { error: "No recipe data found on this page. Try adding the recipe manually." },
        { status: 404 }
      );
    }

    const nutrition = (recipe.nutrition || {}) as Record<string, string>;
    const recipeInstructions = recipe.recipeInstructions as Array<string | { text?: string }> | undefined;
    const recipeIngredient = recipe.recipeIngredient as string[] | undefined;
    const recipeYield = recipe.recipeYield as string | string[] | undefined;
    const image = recipe.image as string | string[] | { url?: string } | undefined;

    const scraped: ScrapedRecipe = {
      title: (recipe.name as string) || "",
      ingredients: (recipeIngredient || []).map((s: string) => parseIngredient(s)),
      instructions: (recipeInstructions || []).map((step) =>
        typeof step === "string" ? step : step.text || ""
      ),
      cookTime: parseDuration(recipe.cookTime as string | undefined),
      prepTime: parseDuration(recipe.prepTime as string | undefined),
      servings: recipeYield
        ? parseInt(String(Array.isArray(recipeYield) ? recipeYield[0] : recipeYield)) || null
        : null,
      calories: parseNutritionValue(nutrition.calories),
      protein: parseNutritionValue(nutrition.proteinContent),
      carbs: parseNutritionValue(nutrition.carbohydrateContent),
      fat: parseNutritionValue(nutrition.fatContent),
      imageUrl: Array.isArray(image)
        ? image[0]
        : typeof image === "string"
          ? image
          : (image as { url?: string })?.url || null,
    };

    return NextResponse.json(scraped);
  } catch {
    return NextResponse.json({ error: "Failed to process URL" }, { status: 500 });
  }
}
