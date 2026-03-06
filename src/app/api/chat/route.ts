import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-3-27b-it:free";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { messages } = await req.json();

  // Fetch her recipe titles for context
  const { data: recipes } = await supabase
    .from("recipes")
    .select("title, ingredients")
    .limit(50);

  const recipeContext = recipes && recipes.length > 0
    ? recipes.map((r: any) => {
        const ingredientNames = Array.isArray(r.ingredients)
          ? r.ingredients.map((ing: any) => ing.name || ing).join(", ")
          : "";
        return `- ${r.title}${ingredientNames ? ` (${ingredientNames})` : ""}`;
      }).join("\n")
    : "No recipes saved yet.";

  const systemPrompt = `You are Jizzy's personal cooking assistant in her Cute Cookbook app. You're warm, friendly, and helpful — like a best friend who loves to cook.

Here are her saved recipes:
${recipeContext}

Help her with:
- Cooking questions and techniques
- Recipe suggestions from her collection or new ideas
- Ingredient substitutions
- Meal planning ideas
- General cooking tips

Keep responses concise and friendly. Use simple language. If she asks about a recipe she has saved, reference it by name.`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://jizzyscookbook.com",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `OpenRouter error: ${error}` }, { status: 502 });
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't think of a response!";

  return NextResponse.json({ reply });
}
