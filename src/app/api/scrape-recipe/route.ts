import { loadEnvConfig } from "@next/env";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { NextRequest, NextResponse } from "next/server";

/** Find directory that contains package.json by walking up from dir */
function findProjectRoot(dir: string): string {
  let current = resolve(dir);
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return dir;
}

// Resolve project root from cwd and from this file's dir (Next.js may run from .next)
const projectRoot =
  typeof __dirname !== "undefined"
    ? findProjectRoot(__dirname)
    : findProjectRoot(process.cwd());
loadEnvConfig(projectRoot);

function getScraperApiKey(): string | undefined {
  let key = process.env.SCRAPER_API_KEY?.trim();
  if (key) return key;
  // Fallback: read .env.local or .env from project root
  for (const root of [projectRoot, process.cwd()]) {
    for (const file of [".env.local", ".env"]) {
      try {
        const envPath = join(root, file);
        if (!existsSync(envPath)) continue;
        const content = readFileSync(envPath, "utf-8").replace(/^\uFEFF/, "");
        for (const line of content.split(/\r?\n/)) {
          const match = line.match(/^SCRAPER_API_KEY\s*=\s*(.*)$/);
          if (match) {
            key = match[1].split("#")[0].trim().replace(/^["']|["']$/g, "");
            if (key) return key;
            break;
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return undefined;
}

/** Force-inject SCRAPER_API_KEY from .env.local into process.env so Next.js dev always sees it */
function injectScraperApiKeyFromFile(): void {
  if (process.env.SCRAPER_API_KEY?.trim()) return;
  for (const root of [process.cwd(), projectRoot]) {
    for (const file of [".env.local", ".env"]) {
      try {
        const envPath = join(root, file);
        if (!existsSync(envPath)) continue;
        const content = readFileSync(envPath, "utf-8").replace(/^\uFEFF/, "");
        for (const line of content.split(/\r?\n/)) {
          const match = line.match(/^SCRAPER_API_KEY\s*=\s*(.*)$/);
          if (match) {
            const value = match[1].split("#")[0].trim().replace(/^["']|["']$/g, "").trim();
            if (value) {
              process.env.SCRAPER_API_KEY = value;
              return;
            }
            break;
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

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

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

/** Optional: set SCRAPER_API_KEY in .env.local (in the same folder as package.json where you run npm run dev) to fetch via ScraperAPI and bypass sites that block direct requests. */
async function fetchRecipeHtml(
  url: string,
  signal: AbortSignal
): Promise<{ html: string; usedScraperApi: boolean }> {
  const apiKey = getScraperApiKey();
  if (apiKey) {
    const proxyUrl = `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal });
    if (!res.ok) {
      throw new Error(`ScraperAPI error: ${res.status}`);
    }
    const html = await res.text();
    return { html, usedScraperApi: true };
  }

  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal,
  });

  if (!response.ok) {
    const message =
      response.status === 403
        ? "This site blocks import. Use “Do it myself” and paste the link in the Source URL box at the bottom of the form to keep the reference. To bypass: add SCRAPER_API_KEY to .env.local in the same folder as package.json (where you run npm run dev). See README."
        : response.status === 404
          ? "Page not found."
          : `Failed to fetch URL (${response.status}). Try adding the recipe manually.`;
    const err = new Error(message) as Error & { keyLoaded?: boolean; projectRoot?: string };
    err.keyLoaded = false;
    err.projectRoot = projectRoot;
    throw err;
  }

  const html = await response.text();
  return { html, usedScraperApi: false };
}

export async function POST(request: NextRequest) {
  try {
    // Ensure SCRAPER_API_KEY is in process.env (read from .env.local if needed)
    injectScraperApiKeyFromFile();
    loadEnvConfig(process.cwd());
    loadEnvConfig(projectRoot);

    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const { html, usedScraperApi } = await fetchRecipeHtml(url, controller.signal);

    clearTimeout(timeoutId);

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

    return NextResponse.json(scraped, {
      headers: { "X-ScraperAPI-Used": usedScraperApi ? "true" : "false" },
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("This site blocks")) {
      const body: { error: string; debug?: { keyLoaded: boolean; projectRoot: string } } = {
        error: err.message,
      };
      const e = err as Error & { keyLoaded?: boolean; projectRoot?: string };
      if (e.keyLoaded === false && e.projectRoot)
        body.debug = { keyLoaded: false, projectRoot: e.projectRoot };
      return NextResponse.json(body, { status: 400 });
    }
    if (err instanceof Error && err.message.startsWith("Page not found")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message.startsWith("Failed to fetch")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Request timed out. The site may be slow—try again or add the recipe manually."
        : err instanceof Error
          ? err.message
          : "Failed to load this URL. Try again or add the recipe manually.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
