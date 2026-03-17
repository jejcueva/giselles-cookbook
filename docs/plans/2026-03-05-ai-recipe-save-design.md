# AI Assistant Recipe Save — Design

## Overview

When the AI assistant suggests a full recipe in chat, it includes structured recipe data as a hidden JSON block. The frontend detects this, renders a "Save to My Recipes" button below the message, and saves directly to Supabase on click.

## How It Works

### 1. System prompt (chat API route)

Update the system prompt to instruct the AI: when you provide a full recipe (with ingredients and instructions), append a fenced JSON block at the end of your message:

```
:::recipe
{"title":"...","ingredients":[{"name":"...","amount":"...","unit":"..."}],"instructions":["..."],"cookTime":null,"prepTime":null,"servings":null,"calories":null,"protein":null,"carbs":null,"fat":null}
:::
```

The AI still writes the recipe in a friendly, readable format. The JSON block is hidden metadata for the frontend.

### 2. Frontend parsing (AI assistant page)

- When rendering an assistant message, check for `:::recipe ... :::` blocks
- Strip the JSON block from the visible message text
- Parse the JSON into a recipe object
- Render a "Save to My Recipes" button below the chat bubble

### 3. Client-side save

- On button click, insert recipe into Supabase `recipes` table using the existing client
- Format ingredients and instructions to match the DB schema (same as `/recipes/new` page does)
- On success, swap button text to "Saved!" with a check mark and disable it
- On error, show inline error text

## Files Modified

- `src/app/api/chat/route.ts` — update system prompt with recipe JSON instructions
- `src/app/ai-assistant/page.tsx` — parse recipe blocks, render save button, save to Supabase
