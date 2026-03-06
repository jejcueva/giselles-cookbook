import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const FREE_FALLBACK_MODEL = "openrouter/free";
const MISSING_OPENROUTER_KEY_ERROR =
  "Missing OPENROUTER_API_KEY. Add it to .env.local and restart the dev server.";
const RATE_LIMIT_ERROR =
  "OpenRouter free models are currently rate-limited. Please retry in a minute, or add credits/BYOK in OpenRouter for higher limits.";

type RecipeIngredient = string | { name?: string | null };
type RecipeContextRow = {
  title: string;
  ingredients: RecipeIngredient[] | null;
};

type OpenRouterRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResult =
  | {
      ok: true;
      data: { choices?: Array<{ message?: { content?: string } }> };
    }
  | {
      ok: false;
      status: number;
      errorText: string;
    };

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function POST(req: NextRequest) {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
  const configuredModel = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;

  if (!openRouterApiKey) {
    return NextResponse.json(
      { error: MISSING_OPENROUTER_KEY_ERROR },
      { status: 500 }
    );
  }

  const { messages } = await req.json();

  let recipeContext = "No recipes saved yet.";
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data: recipes } = await supabase
      .from("recipes")
      .select("title, ingredients")
      .limit(50);

    const recipeRows = (recipes as RecipeContextRow[] | null) ?? [];
    if (recipeRows.length > 0) {
      recipeContext = recipeRows.map((recipe) => {
        const ingredientNames = Array.isArray(recipe.ingredients)
          ? recipe.ingredients
              .map((ingredient) =>
                typeof ingredient === "string" ? ingredient : ingredient.name ?? ""
              )
              .filter(Boolean)
              .join(", ")
          : "";
        return `- ${recipe.title}${ingredientNames ? ` (${ingredientNames})` : ""}`;
      }).join("\n");
    }
  }

  const systemPrompt = `You are Jizzy's personal cooking assistant in her Cute Cookbook app. You're warm, friendly, and helpful — like a best friend who loves to cook.

Here are her saved recipes:
${recipeContext}

Help her with:
- Cooking questions and techniques
- Recipe suggestions from her collection or new ideas
- Ingredient substitutions
- Meal planning ideas
- General cooking tips

Keep responses concise and friendly. Use simple language. If she asks about a recipe she has saved, reference it by name.

IMPORTANT: When you provide a FULL recipe (with ingredients and instructions), you MUST append a hidden JSON block at the very end of your message using this exact format:

:::recipe
{"title":"Recipe Name","ingredients":[{"name":"ingredient","amount":"1","unit":"cup"}],"instructions":["Step 1 text","Step 2 text"],"cookTime":null,"prepTime":null,"servings":null,"calories":null,"protein":null,"carbs":null,"fat":null}
:::

Rules for the recipe block:
- Only include it when giving a FULL recipe with ingredients AND instructions
- Do NOT include it for partial answers, tips, or substitution advice
- Fill in cookTime/prepTime in minutes, servings as a number, macros as numbers — use null if unknown
- The ingredients array must have objects with name, amount, and unit strings
- The instructions array must be plain step strings
- Still write the recipe in a friendly readable format BEFORE the block — the block is hidden metadata`;

  const sendOpenRouterRequest = async (
    model: string,
    chatMessages: OpenRouterRequestMessage[]
  ): Promise<OpenRouterResult> => {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jizzyscookbook.com",
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        errorText: await response.text(),
      };
    }

    return {
      ok: true,
      data: (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      },
    };
  };

  const chatMessages: OpenRouterRequestMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  let result = await sendOpenRouterRequest(configuredModel, chatMessages);

  if (!result.ok && result.status === 429 && configuredModel !== FREE_FALLBACK_MODEL) {
    result = await sendOpenRouterRequest(FREE_FALLBACK_MODEL, chatMessages);
  }

  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    return NextResponse.json(
      { error: `OpenRouter error: ${result.errorText}` },
      { status: 502 }
    );
  }

  const reply =
    result.data.choices?.[0]?.message?.content ||
    "Sorry, I couldn't think of a response!";

  return NextResponse.json({ reply });
}
