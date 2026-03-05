# Phase 5: Features & Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI assistant, unified recipe import (blog + Instagram), holiday themes with custom colors, recipe sharing, and mobile polish with micro-interactions.

**Architecture:** Five independent feature tracks that can be worked on in parallel by separate workers. Each track touches different files with minimal overlap. The theme system uses CSS custom properties with localStorage persistence. AI features use OpenRouter's Gemma 3 27B model via server-side API routes. Recipe sharing uses a public route outside AppShell with Supabase public RLS policy.

**Tech Stack:** Next.js 16, React 19, Supabase JS v2, OpenRouter API (Gemma 3 27B), Tailwind CSS v4, CSS custom properties for theming

**Parallel Worker Tracks:**
- **Track A** (Tasks 1-3): AI Assistant
- **Track B** (Tasks 4-6): Unified Recipe Import
- **Track C** (Tasks 7-10): Holiday Themes + Custom Colors
- **Track D** (Tasks 11-13): Recipe Sharing
- **Track E** (Tasks 14-16): Mobile Polish + Micro-interactions

---

## Track A: AI Assistant

### Task 1: AI chat API route

**Files:**
- Create: `src/app/api/chat/route.ts`

**Step 1: Create the chat API route**

Create `src/app/api/chat/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };

    if (!messages?.length) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    // Fetch recipe titles + ingredients for context
    const { data: recipes } = await supabase
      .from("recipes")
      .select("title, ingredients")
      .limit(50);

    const recipeContext = recipes
      ? recipes
          .map((r: any) => {
            const ings = (r.ingredients || [])
              .map((i: any) => i.name)
              .filter(Boolean)
              .join(", ");
            return `- ${r.title}${ings ? ` (${ings})` : ""}`;
          })
          .join("\n")
      : "No recipes saved yet.";

    const systemMessage: ChatMessage = {
      role: "system",
      content: `You are Jizzy's personal cooking assistant in her cozy cookbook app. You're warm, friendly, and helpful — like a best friend who loves cooking. Use casual language, be encouraging, and add the occasional cute emoji.

Here are her saved recipes:
${recipeContext}

Help with:
- Cooking questions, substitutions, techniques
- Recipe suggestions from her collection
- General cooking advice and meal ideas
- Encouragement and fun cooking tips

Keep responses concise (2-4 paragraphs max). If she asks about a recipe she has saved, reference it by name.`,
    };

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://jizzyscookbook.com",
        },
        body: JSON.stringify({
          model: "google/gemma-3-27b-it:free",
          messages: [systemMessage, ...messages],
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json(
        { error: "AI is taking a break, try again in a sec!" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Hmm, I got confused. Try asking again!";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
```

**Step 2: Add OPENROUTER_API_KEY to .env.local**

Add to `.env.local`:
```
OPENROUTER_API_KEY=your_key_here
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds, `/api/chat` appears as a dynamic route.

**Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "added ai chat api route with openrouter"
```

---

### Task 2: Chat UI component

**Files:**
- Create: `src/components/chat-message.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create chat message component**

Create `src/components/chat-message.tsx`:

```tsx
type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
};

export function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div className={`chat-message chat-message-${role}`}>
      <div className={`chat-bubble chat-bubble-${role}`}>
        {content}
      </div>
    </div>
  );
}
```

**Step 2: Add chat CSS**

In `src/app/globals.css`, add at the end:

```css
/* ── Chat ────────────────────────────────────────────── */

.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  max-width: 720px;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.75rem;
  overflow-y: auto;
  padding: 1rem 0;
}

.chat-message {
  display: flex;
}

.chat-message-user {
  justify-content: flex-end;
}

.chat-message-assistant {
  justify-content: flex-start;
}

.chat-bubble {
  border-radius: 1rem;
  font-size: 0.92rem;
  line-height: 1.55;
  max-width: 80%;
  padding: 0.75rem 1rem;
  white-space: pre-wrap;
}

.chat-bubble-user {
  background: var(--color-primary);
  border-bottom-right-radius: 0.25rem;
  color: #fff;
}

.chat-bubble-assistant {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-bottom-left-radius: 0.25rem;
  color: var(--color-text);
}

.chat-input-row {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
}

.chat-input-row input {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1.5rem;
  color: var(--color-text);
  flex: 1;
  font: inherit;
  font-size: 0.92rem;
  padding: 0.65rem 1rem;
}

.chat-input-row input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.chat-send-btn {
  background: var(--color-primary);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  font-size: 1.1rem;
  height: 40px;
  transition: opacity 0.2s;
  width: 40px;
}

.chat-send-btn:hover {
  opacity: 0.85;
}

.chat-send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.chat-loading {
  align-items: center;
  display: flex;
  gap: 0.3rem;
  padding: 0.5rem 0;
}

.chat-loading-dot {
  animation: chat-bounce 1.2s infinite;
  background: var(--color-secondary);
  border-radius: 50%;
  height: 8px;
  width: 8px;
}

.chat-loading-dot:nth-child(2) { animation-delay: 0.15s; }
.chat-loading-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes chat-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/chat-message.tsx src/app/globals.css
git commit -m "added chat message component and styles"
```

---

### Task 3: AI Assistant page

**Files:**
- Modify: `src/app/ai-assistant/page.tsx`

**Step 1: Build the full chat page**

Replace `src/app/ai-assistant/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { ChatMessage } from "@/components/chat-message";
import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: data.error || "Oops, something went wrong!" },
        ]);
      } else {
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "I couldn't connect right now. Try again?" },
      ]);
    }

    setLoading(false);
  }

  return (
    <AppShell>
      <div className="chat-page">
        <h1 className="section-title">AI Assistant</h1>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-bubble chat-bubble-assistant" style={{ alignSelf: "flex-start" }}>
              Hey Jizzy! I&apos;m your cooking assistant. Ask me anything about recipes, substitutions, or what to cook tonight!
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}

          {loading && (
            <div className="chat-loading">
              <span className="chat-loading-dot" />
              <span className="chat-loading-dot" />
              <span className="chat-loading-dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-row">
          <input
            type="text"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
          />
          <button
            type="button"
            className="chat-send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
      </div>
    </AppShell>
  );
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds. Run `npm run dev` and visit `/ai-assistant` — should show the chat UI with welcome message and input box.

**Step 3: Commit**

```bash
git add src/app/ai-assistant/page.tsx
git commit -m "built ai assistant chat page"
```

---

## Track B: Unified Recipe Import

### Task 4: AI recipe parsing API route

**Files:**
- Create: `src/app/api/parse-recipe/route.ts`

**Step 1: Create the AI parsing route**

Create `src/app/api/parse-recipe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemma-3-27b-it:free",
          messages: [
            {
              role: "system",
              content: `Extract a recipe from the following text. Return ONLY valid JSON with this exact structure:
{
  "title": "Recipe Name",
  "ingredients": [{"name": "flour", "amount": "2", "unit": "cups"}],
  "instructions": ["Step 1 text", "Step 2 text"],
  "cookTime": null,
  "prepTime": null,
  "servings": null,
  "calories": null,
  "protein": null,
  "carbs": null,
  "fat": null
}
Fill in what you can find. Use null for missing fields. For ingredients, split amount and unit from the name. Return ONLY the JSON, no markdown or explanation.`,
            },
            { role: "user", content: text },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "AI parsing failed, try again" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Could not parse recipe from text" },
        { status: 422 }
      );
    }

    // Try to extract JSON from the response (might have markdown wrapping)
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json(
          { error: "Could not parse AI response" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to process text" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds, `/api/parse-recipe` route appears.

**Step 3: Commit**

```bash
git add src/app/api/parse-recipe/route.ts
git commit -m "added ai recipe parsing api route"
```

---

### Task 5: Unified import API route

**Files:**
- Create: `src/app/api/import-recipe/route.ts`
- Modify: `src/app/api/scrape-recipe/route.ts` (rename/keep as fallback)

**Step 1: Create the unified import route**

Create `src/app/api/import-recipe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  return (parseInt(match[1] || "0") * 60 + parseInt(match[2] || "0")) || null;
}

function parseNutritionValue(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseIngredient(raw: string) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 3 && /^\d/.test(parts[0])) {
    return { amount: parts[0], unit: parts[1], name: parts.slice(2).join(" ") };
  }
  if (parts.length >= 2 && /^\d/.test(parts[0])) {
    return { amount: parts[0], unit: "", name: parts.slice(1).join(" ") };
  }
  return { amount: "", unit: "", name: raw.trim() };
}

function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel)\//i.test(url);
}

async function scrapeJsonLd(html: string) {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const c of candidates) {
        if (c["@type"] === "Recipe" || (Array.isArray(c["@type"]) && c["@type"].includes("Recipe"))) return c;
        if (c["@graph"]) {
          for (const n of c["@graph"]) {
            if (n["@type"] === "Recipe" || (Array.isArray(n["@type"]) && n["@type"].includes("Recipe"))) return n;
          }
        }
      }
    } catch { /* skip */ }
  }
  return null;
}

function recipeFromJsonLd(recipe: any) {
  const nutrition = recipe.nutrition || {};
  const image = recipe.image;
  const recipeYield = recipe.recipeYield;
  return {
    title: recipe.name || "",
    ingredients: (recipe.recipeIngredient || []).map((s: string) => parseIngredient(s)),
    instructions: (recipe.recipeInstructions || []).map((step: any) =>
      typeof step === "string" ? step : step.text || ""
    ),
    cookTime: parseDuration(recipe.cookTime),
    prepTime: parseDuration(recipe.prepTime),
    servings: recipeYield ? parseInt(String(Array.isArray(recipeYield) ? recipeYield[0] : recipeYield)) || null : null,
    calories: parseNutritionValue(nutrition.calories),
    protein: parseNutritionValue(nutrition.proteinContent),
    carbs: parseNutritionValue(nutrition.carbohydrateContent),
    fat: parseNutritionValue(nutrition.fatContent),
    imageUrl: Array.isArray(image) ? image[0] : typeof image === "string" ? image : image?.url || null,
  };
}

async function aiParseText(text: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      messages: [
        {
          role: "system",
          content: `Extract a recipe from this text. Return ONLY valid JSON: {"title":"...","ingredients":[{"name":"...","amount":"...","unit":"..."}],"instructions":["step1","step2"],"cookTime":null,"prepTime":null,"servings":null,"calories":null,"protein":null,"carbs":null,"fat":null}. Use null for missing fields.`,
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, text } = body;

    // If raw text was pasted (Instagram caption fallback)
    if (text && typeof text === "string") {
      const parsed = await aiParseText(text);
      if (!parsed) {
        return NextResponse.json({ error: "Could not parse recipe from text" }, { status: 422 });
      }
      return NextResponse.json(parsed);
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL or text is required" }, { status: 400 });
    }

    // Instagram URL: try oEmbed for caption
    if (isInstagramUrl(url)) {
      try {
        const oembedRes = await fetch(
          `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&omitscript=true`
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          if (oembed.title) {
            const parsed = await aiParseText(oembed.title);
            if (parsed) return NextResponse.json(parsed);
          }
        }
      } catch { /* fall through */ }

      // If oEmbed fails, tell client to use text paste fallback
      return NextResponse.json(
        { error: "instagram_paste_needed", message: "Paste the Instagram caption below" },
        { status: 422 }
      );
    }

    // Blog URL: fetch and try JSON-LD first
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CuteCookbook/1.0)" },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 });
    }

    const html = await response.text();
    const jsonLdRecipe = await scrapeJsonLd(html);

    if (jsonLdRecipe) {
      return NextResponse.json(recipeFromJsonLd(jsonLdRecipe));
    }

    // Fallback: send page text to AI
    const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
    const parsed = await aiParseText(textContent);
    if (parsed) return NextResponse.json(parsed);

    return NextResponse.json(
      { error: "No recipe data found on this page." },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/import-recipe/route.ts
git commit -m "added unified import route with blog scraping and ai fallback"
```

---

### Task 6: Import recipe modal component + wire to form

**Files:**
- Create: `src/components/import-modal.tsx`
- Modify: `src/app/recipes/new/page.tsx` — update import section to use new unified route
- Modify: `src/app/globals.css`

**Step 1: Create import modal component**

Create `src/components/import-modal.tsx`:

```tsx
"use client";

import { useState } from "react";

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImport: (data: any) => void;
};

export function ImportModal({ open, onClose, onImport }: ImportModalProps) {
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleImport() {
    setLoading(true);
    setError("");

    try {
      const body = showPaste ? { text: pasteText.trim() } : { url: url.trim() };
      const res = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.error === "instagram_paste_needed") {
        setShowPaste(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Import failed");
        setLoading(false);
        return;
      }

      onImport(data);
      onClose();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Import Recipe</h2>

        {!showPaste ? (
          <>
            <label className="form-label">
              Paste a recipe URL (blog or Instagram)
              <input
                type="url"
                className="form-input"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleImport(); } }}
              />
            </label>
          </>
        ) : (
          <>
            <p className="modal-note">Instagram requires pasting the caption manually:</p>
            <label className="form-label">
              Paste the recipe caption
              <textarea
                className="form-textarea"
                placeholder="Paste the Instagram caption here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
              />
            </label>
          </>
        )}

        {error && <p className="import-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleImport}
            disabled={loading || (!showPaste && !url.trim()) || (showPaste && !pasteText.trim())}
          >
            {loading ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add modal CSS**

In `src/app/globals.css`, add:

```css
/* ── Modal ───────────────────────────────────────────── */

.modal-overlay {
  align-items: center;
  background: rgba(74, 55, 40, 0.4);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 100;
}

.modal-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  box-shadow: 0 20px 60px rgba(74, 55, 40, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 480px;
  padding: 1.5rem;
  width: 90vw;
}

.modal-title {
  font-size: 1.2rem;
}

.modal-note {
  color: var(--color-secondary);
  font-size: 0.88rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}
```

**Step 3: Update the recipe form import section**

In `src/app/recipes/new/page.tsx`, update the `handleImport` function to call `/api/import-recipe` instead of `/api/scrape-recipe`.

Change:
```tsx
const res = await fetch("/api/scrape-recipe", {
```
To:
```tsx
const res = await fetch("/api/import-recipe", {
```

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/import-modal.tsx src/app/globals.css src/app/recipes/new/page.tsx
git commit -m "added import recipe modal with instagram paste fallback"
```

---

## Track C: Holiday Themes + Custom Colors

### Task 7: Theme definitions

**Files:**
- Create: `src/lib/themes.ts`

**Step 1: Create theme definitions**

Create `src/lib/themes.ts`:

```ts
export type Theme = {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    surface: string;
    border: string;
  };
  decoration: string | null; // CSS class name for decoration overlay
};

export const THEMES: Theme[] = [
  {
    id: "default",
    name: "Cottagecore",
    colors: { primary: "#F2B8C6", secondary: "#A67B5B", accent: "#A8BFA0", background: "#FFF8F0", text: "#4A3728", surface: "#FFFDFB", border: "#EBD8C8" },
    decoration: null,
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    colors: { primary: "#E8355A", secondary: "#8B2252", accent: "#FFB6C1", background: "#FFF0F3", text: "#4A1525", surface: "#FFFBFC", border: "#F5D0D8" },
    decoration: "deco-hearts",
  },
  {
    id: "stpatricks",
    name: "St. Patrick's",
    colors: { primary: "#2E8B57", secondary: "#DAA520", accent: "#98FB98", background: "#F0FFF0", text: "#1A3A2A", surface: "#F8FFF8", border: "#C8E8C8" },
    decoration: "deco-shamrocks",
  },
  {
    id: "halloween",
    name: "Halloween",
    colors: { primary: "#FF6B1A", secondary: "#2D1B69", accent: "#8B008B", background: "#1A1A2E", text: "#F0E0D0", surface: "#252540", border: "#3A3A5A" },
    decoration: "deco-spooky",
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    colors: { primary: "#CC5500", secondary: "#8B4513", accent: "#DAA520", background: "#FFF8DC", text: "#3A2510", surface: "#FFFEF8", border: "#E8D8B8" },
    decoration: "deco-leaves",
  },
  {
    id: "christmas",
    name: "Christmas",
    colors: { primary: "#C41E3A", secondary: "#006400", accent: "#FFD700", background: "#FFF8F0", text: "#2A1A1A", surface: "#FFFDFB", border: "#E8C8C8" },
    decoration: "deco-snowflakes",
  },
  {
    id: "newyear",
    name: "New Year's",
    colors: { primary: "#FFD700", secondary: "#C0C0C0", accent: "#FFD700", background: "#0D0D1A", text: "#F0E8D8", surface: "#1A1A2E", border: "#2A2A4A" },
    decoration: "deco-sparkles",
  },
];

export const CUSTOM_COLORS = [
  { name: "Pink", hex: "#F2B8C6" },
  { name: "Lavender", hex: "#C8A2D4" },
  { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Coral", hex: "#FF7F7F" },
  { name: "Mint", hex: "#98D4BB" },
  { name: "Peach", hex: "#FFCBA4" },
  { name: "Sage", hex: "#A8BFA0" },
  { name: "Rose", hex: "#E8457C" },
];

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return THEMES[0];
  const id = localStorage.getItem("cookbook-theme");
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function getStoredCustomColor(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cookbook-custom-color");
}

export function applyTheme(theme: Theme, customColor?: string | null) {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty("--color-primary", customColor || c.primary);
  root.style.setProperty("--color-secondary", c.secondary);
  root.style.setProperty("--color-accent", c.accent);
  root.style.setProperty("--color-background", c.background);
  root.style.setProperty("--color-text", c.text);
  root.style.setProperty("--color-surface", c.surface);
  root.style.setProperty("--color-border", c.border);
  document.body.style.background = c.background;
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/themes.ts
git commit -m "added theme definitions and color constants"
```

---

### Task 8: Theme provider component

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create theme provider**

Create `src/components/theme-provider.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { getStoredTheme, getStoredCustomColor, applyTheme } from "@/lib/themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const theme = getStoredTheme();
    const customColor = getStoredCustomColor();
    applyTheme(theme, customColor);
  }, []);

  return <>{children}</>;
}
```

**Step 2: Wrap layout with ThemeProvider**

In `src/app/layout.tsx`, import and wrap:

Add import:
```tsx
import { ThemeProvider } from "@/components/theme-provider";
```

Change the body content from:
```tsx
<body className={`${nunito.variable} ${playfair.variable} ${dancingScript.variable}`}>{children}</body>
```
To:
```tsx
<body className={`${nunito.variable} ${playfair.variable} ${dancingScript.variable}`}>
  <ThemeProvider>{children}</ThemeProvider>
</body>
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/theme-provider.tsx src/app/layout.tsx
git commit -m "added theme provider to layout"
```

---

### Task 9: Decoration overlays

**Files:**
- Create: `src/components/decorations.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create lightweight decoration components**

Create `src/components/decorations.tsx`:

```tsx
"use client";

export function DecoHearts() {
  return (
    <div className="deco-overlay">
      {[...Array(5)].map((_, i) => (
        <span key={i} className="deco-particle deco-heart" style={{ left: `${15 + i * 18}%`, animationDelay: `${i * 1.5}s` }}>
          ♥
        </span>
      ))}
    </div>
  );
}

export function DecoSnowflakes() {
  return (
    <div className="deco-overlay">
      {[...Array(6)].map((_, i) => (
        <span key={i} className="deco-particle deco-snow" style={{ left: `${8 + i * 16}%`, animationDelay: `${i * 2}s` }}>
          ❄
        </span>
      ))}
    </div>
  );
}

export function DecoLeaves() {
  return (
    <div className="deco-overlay">
      {[...Array(4)].map((_, i) => (
        <span key={i} className="deco-particle deco-leaf" style={{ left: `${10 + i * 22}%`, animationDelay: `${i * 2.5}s` }}>
          🍂
        </span>
      ))}
    </div>
  );
}

export function DecoSparkles() {
  return (
    <div className="deco-overlay">
      {[...Array(5)].map((_, i) => (
        <span key={i} className="deco-particle deco-sparkle" style={{ left: `${12 + i * 18}%`, animationDelay: `${i * 1.8}s` }}>
          ✦
        </span>
      ))}
    </div>
  );
}

export function DecoShamrocks() {
  return (
    <div className="deco-overlay">
      {[...Array(4)].map((_, i) => (
        <span key={i} className="deco-particle deco-shamrock" style={{ left: `${15 + i * 20}%`, animationDelay: `${i * 2.2}s` }}>
          ☘
        </span>
      ))}
    </div>
  );
}

export function DecoSpooky() {
  return (
    <div className="deco-overlay">
      {[...Array(4)].map((_, i) => (
        <span key={i} className="deco-particle deco-spooky-item" style={{ left: `${12 + i * 22}%`, animationDelay: `${i * 2}s` }}>
          {i % 2 === 0 ? "🎃" : "🕸"}
        </span>
      ))}
    </div>
  );
}

const DECORATION_MAP: Record<string, React.ComponentType> = {
  "deco-hearts": DecoHearts,
  "deco-snowflakes": DecoSnowflakes,
  "deco-leaves": DecoLeaves,
  "deco-sparkles": DecoSparkles,
  "deco-shamrocks": DecoShamrocks,
  "deco-spooky": DecoSpooky,
};

export function Decoration({ name }: { name: string | null }) {
  if (!name) return null;
  const Component = DECORATION_MAP[name];
  return Component ? <Component /> : null;
}
```

**Step 2: Add decoration CSS**

In `src/app/globals.css`, add:

```css
/* ── Decorations ─────────────────────────────────────── */

.deco-overlay {
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  position: fixed;
  z-index: 99;
}

.deco-particle {
  animation: deco-float 8s ease-in-out infinite;
  font-size: 1.2rem;
  opacity: 0.15;
  position: absolute;
  top: -2rem;
}

@keyframes deco-float {
  0% { transform: translateY(-2rem) rotate(0deg); opacity: 0; }
  10% { opacity: 0.15; }
  90% { opacity: 0.15; }
  100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
}
```

**Step 3: Update ThemeProvider to render decorations**

In `src/components/theme-provider.tsx`, update:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getStoredTheme, getStoredCustomColor, applyTheme, Theme } from "@/lib/themes";
import { Decoration } from "@/components/decorations";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [decoration, setDecoration] = useState<string | null>(null);

  useEffect(() => {
    const theme = getStoredTheme();
    const customColor = getStoredCustomColor();
    applyTheme(theme, customColor);
    setDecoration(theme.decoration);
  }, []);

  return (
    <>
      <Decoration name={decoration} />
      {children}
    </>
  );
}
```

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/decorations.tsx src/components/theme-provider.tsx src/app/globals.css
git commit -m "added holiday decoration overlays"
```

---

### Task 10: Settings page — theme picker + custom color

**Files:**
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Build the settings page**

Replace `src/app/settings/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { THEMES, CUSTOM_COLORS, applyTheme, Theme } from "@/lib/themes";
import { useState } from "react";

export default function SettingsPage() {
  const [activeThemeId, setActiveThemeId] = useState(() => {
    if (typeof window === "undefined") return "default";
    return localStorage.getItem("cookbook-theme") || "default";
  });
  const [customColor, setCustomColor] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("cookbook-custom-color");
  });

  function selectTheme(theme: Theme) {
    setActiveThemeId(theme.id);
    setCustomColor(null);
    localStorage.setItem("cookbook-theme", theme.id);
    localStorage.removeItem("cookbook-custom-color");
    applyTheme(theme);
    // Reload to update decorations
    window.location.reload();
  }

  function selectColor(hex: string) {
    setCustomColor(hex);
    localStorage.setItem("cookbook-custom-color", hex);
    const theme = THEMES.find((t) => t.id === activeThemeId) || THEMES[0];
    applyTheme(theme, hex);
  }

  return (
    <AppShell>
      <div className="settings-page">
        <h1 className="section-title">Settings</h1>

        <section className="settings-section">
          <h2 className="settings-section-title">Theme</h2>
          <div className="theme-grid">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`theme-card ${activeThemeId === theme.id ? "active" : ""}`}
                onClick={() => selectTheme(theme)}
              >
                <div className="theme-swatches">
                  <span className="theme-swatch" style={{ background: theme.colors.primary }} />
                  <span className="theme-swatch" style={{ background: theme.colors.secondary }} />
                  <span className="theme-swatch" style={{ background: theme.colors.accent }} />
                  <span className="theme-swatch" style={{ background: theme.colors.background, border: "1px solid #ddd" }} />
                </div>
                <span className="theme-name">{theme.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Custom Accent Color</h2>
          <p className="settings-note">Override the primary color without changing the theme</p>
          <div className="color-picker-row">
            {CUSTOM_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`color-swatch-btn ${customColor === c.hex ? "active" : ""}`}
                style={{ background: c.hex }}
                onClick={() => selectColor(c.hex)}
                title={c.name}
                aria-label={c.name}
              />
            ))}
            {customColor && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setCustomColor(null);
                  localStorage.removeItem("cookbook-custom-color");
                  const theme = THEMES.find((t) => t.id === activeThemeId) || THEMES[0];
                  applyTheme(theme);
                }}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
              >
                Reset
              </button>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
```

**Step 2: Add settings CSS**

In `src/app/globals.css`, add:

```css
/* ── Settings ────────────────────────────────────────── */

.settings-page {
  max-width: 640px;
}

.settings-section {
  margin-top: 1.5rem;
}

.settings-section-title {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.settings-note {
  color: var(--color-secondary);
  font-size: 0.82rem;
  margin-bottom: 0.75rem;
}

.theme-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.theme-card {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  transition: border-color 0.2s, transform 0.2s;
}

.theme-card:hover {
  transform: translateY(-2px);
}

.theme-card.active {
  border-color: var(--color-primary);
}

.theme-swatches {
  display: flex;
  gap: 0.3rem;
}

.theme-swatch {
  border-radius: 50%;
  height: 20px;
  width: 20px;
}

.theme-name {
  color: var(--color-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.color-picker-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.color-swatch-btn {
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  height: 36px;
  transition: transform 0.2s, border-color 0.2s;
  width: 36px;
}

.color-swatch-btn:hover {
  transform: scale(1.15);
}

.color-swatch-btn.active {
  border-color: var(--color-text);
}
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds. Run `npm run dev` and visit `/settings` — should show theme grid and color swatches.

**Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/app/globals.css
git commit -m "built settings page with theme picker and custom colors"
```

---

## Track D: Recipe Sharing

### Task 11: Public share page

**Files:**
- Create: `src/app/share/[id]/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create public share page**

Create `src/app/share/[id]/page.tsx`:

```tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SharePage({ params }: Props) {
  const { id } = await params;

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (!recipe) {
    return (
      <div className="share-page">
        <div className="share-card">
          <h1>Recipe not found</h1>
        </div>
      </div>
    );
  }

  const hasMacros = recipe.calories || recipe.protein || recipe.carbs || recipe.fat;

  return (
    <div className="share-page">
      <div className="share-card">
        {recipe.cover_image_url && (
          <img src={recipe.cover_image_url} alt={recipe.title} className="share-hero" />
        )}

        <h1 className="share-title">{recipe.title}</h1>

        <div className="recipe-detail-meta">
          {recipe.prep_time && <span className="meta-chip">Prep: {recipe.prep_time}m</span>}
          {recipe.cook_time && <span className="meta-chip">Cook: {recipe.cook_time}m</span>}
          {recipe.servings && <span className="meta-chip">Serves {recipe.servings}</span>}
        </div>

        {hasMacros && (
          <div className="nutrition-card">
            <h3 className="nutrition-title">Nutrition (per serving)</h3>
            <div className="nutrition-grid">
              {recipe.calories != null && (<div className="nutrition-item"><span className="nutrition-value">{recipe.calories}</span><span className="nutrition-label">cal</span></div>)}
              {recipe.protein != null && (<div className="nutrition-item"><span className="nutrition-value">{recipe.protein}g</span><span className="nutrition-label">protein</span></div>)}
              {recipe.carbs != null && (<div className="nutrition-item"><span className="nutrition-value">{recipe.carbs}g</span><span className="nutrition-label">carbs</span></div>)}
              {recipe.fat != null && (<div className="nutrition-item"><span className="nutrition-value">{recipe.fat}g</span><span className="nutrition-label">fat</span></div>)}
            </div>
          </div>
        )}

        {recipe.ingredients?.length > 0 && (
          <section className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Ingredients</h2>
            <ul className="share-ingredient-list">
              {recipe.ingredients.map((ing: any, i: number) => (
                <li key={i}>
                  {ing.amount && `${ing.amount} `}{ing.unit && `${ing.unit} `}{ing.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {recipe.instructions?.length > 0 && (
          <section className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Instructions</h2>
            <ol className="instruction-list">
              {recipe.instructions.map((step: any, i: number) => (
                <li key={i} className="instruction-step">{step.text}</li>
              ))}
            </ol>
          </section>
        )}

        {recipe.notes && (
          <section className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Notes</h2>
            <p className="recipe-notes-text">{recipe.notes}</p>
          </section>
        )}

        <p className="share-footer">Shared from Jizzy&apos;s Cookbook</p>
      </div>
    </div>
  );
}
```

**Step 2: Add share page CSS**

In `src/app/globals.css`, add:

```css
/* ── Share page ──────────────────────────────────────── */

.share-page {
  align-items: flex-start;
  background: var(--color-background);
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem 1rem;
}

.share-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  max-width: 640px;
  padding: 2rem;
  width: 100%;
}

.share-hero {
  border-radius: 0.25rem;
  display: block;
  max-height: 320px;
  object-fit: cover;
  width: 100%;
}

.share-title {
  color: var(--color-text);
  font-size: 1.8rem;
  margin-top: 1rem;
}

.share-ingredient-list {
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  font-size: 0.92rem;
  gap: 0.3rem;
  padding-left: 1.25rem;
}

.share-footer {
  color: var(--color-secondary);
  font-size: 0.78rem;
  font-style: italic;
  margin-top: 2rem;
  text-align: center;
}
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds, `/share/[id]` route appears.

**Step 4: Commit**

```bash
git add src/app/share/\\[id\\]/page.tsx src/app/globals.css
git commit -m "added public recipe share page"
```

---

### Task 12: Share button on recipe detail page

**Files:**
- Modify: `src/app/recipes/[id]/page.tsx`

**Step 1: Add share button with copy-to-clipboard**

In `src/app/recipes/[id]/page.tsx`, add state:

```tsx
const [copied, setCopied] = useState(false);

async function handleShare() {
  const shareUrl = `${window.location.origin}/share/${recipe!.id}`;
  await navigator.clipboard.writeText(shareUrl);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}
```

Add a share button in the `recipe-detail-actions` div, before Edit:

```tsx
<button type="button" className="btn-secondary" onClick={handleShare}>
  {copied ? "Link Copied!" : "Share"}
</button>
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/recipes/\\[id\\]/page.tsx
git commit -m "added share button to recipe detail page"
```

---

### Task 13: Supabase public RLS policy for share route

**Files:**
- Create: `supabase/migrations/20260305_public_read_recipes.sql`

**Step 1: Create migration for public read access**

Create `supabase/migrations/20260305_public_read_recipes.sql`:

```sql
-- Allow public (anon) read access to recipes for the share page
CREATE POLICY "public_read_recipes" ON recipes
  FOR SELECT
  USING (true);
```

**Step 2: Apply migration**

Run via Supabase dashboard SQL editor or:
```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260305_public_read_recipes.sql
git commit -m "added public read rls policy for recipe sharing"
```

---

## Track E: Mobile Polish + Micro-interactions

### Task 14: Mobile responsive layout

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/app-shell.tsx`

**Step 1: Update mobile breakpoint for bottom tab bar**

In `src/app/globals.css`, replace the existing `@media (max-width: 960px)` block with:

```css
@media (max-width: 960px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }

  .sidebar {
    border-bottom: none;
    border-right: none;
    border-top: 1px solid var(--color-border);
    flex-direction: row;
    gap: 0;
    justify-content: space-around;
    order: 2;
    padding: 0.5rem;
  }

  .sidebar-header,
  .sidebar-top,
  .sidebar-toggle,
  .nav-divider,
  .logout-button {
    display: none;
  }

  .sidebar-nav {
    flex-direction: row;
    gap: 0;
    justify-content: space-around;
    width: 100%;
  }

  .nav-link {
    align-items: center;
    display: flex;
    font-size: 0.72rem !important;
    justify-content: center;
    min-height: 44px;
    min-width: 44px;
    padding: 0.4rem 0.6rem;
  }

  .main-column {
    height: calc(100vh - 60px);
    order: 1;
  }

  .topbar {
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  .recipe-grid {
    grid-template-columns: 1fr;
  }

  .form-row-3 {
    grid-template-columns: 1fr;
  }

  .recipe-detail-title {
    font-size: 1.4rem;
  }

  .hero-panel {
    display: none;
  }
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds. On mobile viewport, sidebar appears as bottom tab bar.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "added mobile bottom tab bar layout"
```

---

### Task 15: Micro-interactions

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add micro-interaction CSS**

In `src/app/globals.css`, add:

```css
/* ── Micro-interactions ──────────────────────────────── */

@keyframes heart-pop {
  0% { transform: scale(1); }
  30% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.favorite-btn.favorited {
  animation: heart-pop 0.3s ease;
  color: #e8457c;
}

.btn-primary:active,
.btn-secondary:active,
.btn-danger:active {
  transform: scale(0.96);
}

.recipe-card {
  transition: box-shadow 0.2s, transform 0.2s;
}

.recipe-card:active {
  transform: scale(0.98);
}

.search-dropdown {
  animation: dropdown-slide 0.15s ease;
}

@keyframes dropdown-slide {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Loading skeletons ───────────────────────────────── */

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.skeleton {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  background: var(--color-border);
  border-radius: 0.25rem;
}

.skeleton-card {
  height: 120px;
}

.skeleton-line {
  height: 14px;
  margin-bottom: 0.5rem;
  width: 60%;
}

.skeleton-line-short {
  height: 12px;
  width: 40%;
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "added micro-interactions and loading skeletons"
```

---

### Task 16: Final build + smoke test

**Step 1: Run the build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Smoke test checklist**

Run: `npm run dev` and verify:
- [ ] `/ai-assistant` — chat UI loads, messages send and receive
- [ ] `/settings` — themes switch, custom colors apply, decorations show
- [ ] `/recipes/new` — import from URL still works (now via unified route)
- [ ] `/share/[id]` — public page loads without auth
- [ ] Recipe detail "Share" button copies link
- [ ] Mobile viewport — bottom tab bar, single column cards
- [ ] Micro-interactions — heart pop, button press, search dropdown slide

**Step 3: Commit**

```bash
git add -A
git commit -m "phase 5 features complete"
```
