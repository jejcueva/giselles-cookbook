import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";
const MISSING_GEMINI_KEY_ERROR =
  "Missing GEMINI_API_KEY. Add it to .env.local and restart the dev server.";

type RecipeIngredient = string | { name?: string | null };
type RecipeContextRow = {
  title: string;
  ingredients: RecipeIngredient[] | null;
};

type OpenRouterRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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
  // Prefer env, but allow a direct key during local dev if env loading is flaky.
  const geminiApiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    "";

  if (!geminiApiKey) {
    return NextResponse.json(
      { error: MISSING_GEMINI_KEY_ERROR },
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
    chatMessages: OpenRouterRequestMessage[]
  ) => {
    const response = await fetch(GEMINI_API_URL + `?key=${encodeURIComponent(geminiApiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: chatMessages.map((m) => ({
          role: m.role === "assistant" ? "model" : m.role,
          parts: [{ text: m.content }],
        })),
      }),
    });

    return response;
  };

  const chatMessages: OpenRouterRequestMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await sendOpenRouterRequest(chatMessages);
  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: `Gemini API error (${response.status}): ${text}` },
      { status: 502 }
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const reply =
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Sorry, I couldn't think of a response!";

  return NextResponse.json({ reply });
}
