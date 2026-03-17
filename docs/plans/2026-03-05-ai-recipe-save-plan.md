# AI Assistant Recipe Save — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When the AI assistant gives a full recipe in chat, show a "Save to My Recipes" button that saves it directly to Supabase.

**Architecture:** The chat API system prompt instructs the AI to append a `:::recipe {...} :::` JSON block when it provides a full recipe. The frontend parses this block out of the message, hides it from display, and renders a save button. Save inserts directly into Supabase using the existing client.

**Tech Stack:** Next.js 16, React 19, Supabase JS v2, OpenRouter API

---

## Task 1: Update chat API system prompt

**Files:**
- Modify: `src/app/api/chat/route.ts:82-94`

**Step 1: Update the system prompt**

Replace the system prompt string (lines 82-94) with:

```ts
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
```

**Step 2: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "update chat system prompt to include recipe json blocks"
```

---

## Task 2: Add recipe block parsing and save button to AI assistant page

**Files:**
- Modify: `src/app/ai-assistant/page.tsx`

**Step 1: Add the Supabase import and recipe type**

Add these imports at the top of the file (after the existing imports on lines 1-4):

```ts
import { supabase } from "@/lib/supabase";
```

Add a type for parsed recipe data after the `Message` type (after line 8):

```ts
type RecipeData = {
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
};
```

**Step 2: Add the parsing helper function**

Add this function before the `AIAssistantPage` component:

```ts
const RECIPE_BLOCK_REGEX = /:::recipe\s*([\s\S]*?)\s*:::/;

function parseRecipeBlock(content: string): { text: string; recipe: RecipeData | null } {
  const match = content.match(RECIPE_BLOCK_REGEX);
  if (!match) return { text: content, recipe: null };

  const text = content.replace(RECIPE_BLOCK_REGEX, "").trim();
  try {
    const recipe = JSON.parse(match[1]) as RecipeData;
    if (recipe.title && Array.isArray(recipe.ingredients) && Array.isArray(recipe.instructions)) {
      return { text, recipe };
    }
  } catch {
    // malformed JSON — just show the message normally
  }
  return { text: content, recipe: null };
}
```

**Step 3: Add the ChatBubble component with save functionality**

Add this component before `AIAssistantPage`:

```tsx
function ChatBubble({ msg }: { msg: Message }) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (msg.role === "user") {
    return <div className="chat-bubble chat-bubble-user">{msg.content}</div>;
  }

  const { text, recipe } = parseRecipeBlock(msg.content);

  async function handleSave() {
    if (!recipe || saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");

    try {
      const { error } = await supabase.from("recipes").insert({
        title: recipe.title.trim(),
        ingredients: recipe.ingredients.filter((ing) => ing.name.trim()),
        instructions: recipe.instructions
          .filter((s) => s.trim())
          .map((stepText, i) => ({ step_number: i + 1, text: stepText })),
        cook_time: recipe.cookTime,
        prep_time: recipe.prepTime,
        servings: recipe.servings,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
      });

      if (error) {
        setSaveState("error");
      } else {
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="chat-bubble chat-bubble-assistant">
      {text}
      {recipe && (
        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--color-border, #ebd8c8)" }}>
          <button
            className={saveState === "saved" ? "btn-secondary" : "btn-primary"}
            onClick={handleSave}
            disabled={saveState === "saving" || saveState === "saved"}
            style={{ fontSize: "0.85rem", padding: "0.4rem 1rem" }}
          >
            {saveState === "idle" && "Save to My Recipes"}
            {saveState === "saving" && "Saving..."}
            {saveState === "saved" && "Saved!"}
            {saveState === "error" && "Failed — Try Again"}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Update the message rendering in the JSX**

Replace the message map block (the `{messages.map(...)}` on lines 57-61) with:

```tsx
          {messages.map((msg, i) => (
            <ChatBubble key={i} msg={msg} />
          ))}
```

**Step 5: Commit**

```bash
git add src/app/ai-assistant/page.tsx
git commit -m "add save recipe button to ai assistant chat"
```
