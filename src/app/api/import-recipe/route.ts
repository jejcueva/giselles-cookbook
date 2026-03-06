import { NextRequest, NextResponse } from "next/server";

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

    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        const content = match.replace(/<script[^>]*>|<\/script>/gi, "");
        try {
          let parsed = JSON.parse(content);

          if (parsed["@graph"]) {
            parsed = parsed["@graph"].find((item: any) =>
              item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
            );
          }

          if (Array.isArray(parsed)) {
            parsed = parsed.find((item: any) =>
              item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
            );
          }

          if (parsed && (parsed["@type"] === "Recipe" || (Array.isArray(parsed["@type"]) && parsed["@type"].includes("Recipe")))) {
            const recipe = {
              title: parsed.name || "",
              ingredients: (parsed.recipeIngredient || []).map((ing: string) => ({
                name: ing,
                amount: "",
                unit: "",
              })),
              instructions: (parsed.recipeInstructions || []).map((step: any, i: number) => ({
                step_number: i + 1,
                text: typeof step === "string" ? step : step.text || "",
              })),
              cook_time: parseDuration(parsed.cookTime),
              prep_time: parseDuration(parsed.prepTime),
              servings: parsed.recipeYield ? parseInt(String(parsed.recipeYield), 10) || null : null,
              calories: parsed.nutrition?.calories ? parseInt(String(parsed.nutrition.calories), 10) || null : null,
              protein: parsed.nutrition?.proteinContent ? parseFloat(String(parsed.nutrition.proteinContent)) || null : null,
              carbs: parsed.nutrition?.carbohydrateContent ? parseFloat(String(parsed.nutrition.carbohydrateContent)) || null : null,
              fat: parsed.nutrition?.fatContent ? parseFloat(String(parsed.nutrition.fatContent)) || null : null,
              cover_image_url: parsed.image ? (Array.isArray(parsed.image) ? parsed.image[0] : typeof parsed.image === "string" ? parsed.image : parsed.image.url || null) : null,
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch URL" }, { status: 500 });
  }
}

function parseDuration(iso?: string): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  return (parseInt(match[1] || "0") * 60) + parseInt(match[2] || "0") || null;
}
