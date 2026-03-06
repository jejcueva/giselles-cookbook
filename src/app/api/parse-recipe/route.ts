import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-3-27b-it:free";

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const systemPrompt = `You are a recipe parser. Extract recipe data from the text provided and return ONLY valid JSON with this exact structure:

{
  "title": "Recipe Name",
  "ingredients": [{"name": "flour", "amount": "2", "unit": "cups"}],
  "instructions": [{"step_number": 1, "text": "Preheat oven to 350F"}],
  "cook_time": null,
  "prep_time": null,
  "servings": null
}

Rules:
- If a field is not found in the text, set it to null (or empty array for ingredients/instructions)
- cook_time and prep_time are integers in minutes
- Return ONLY the JSON object, no markdown, no explanation
- Do your best to parse even messy or casual text (like Instagram captions)`;

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
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "AI parsing failed" }, { status: 502 });
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ recipe: parsed });
  } catch {
    return NextResponse.json({ error: "Could not parse AI response", raw }, { status: 422 });
  }
}
