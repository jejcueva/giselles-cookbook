# Phase 4 Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recipe import (Instagram + blog URLs), AI cooking assistant, holiday themes with custom colors, and recipe sharing to the cookbook app.

**Architecture:** Four independent feature areas, each with its own API routes and UI. Theme system uses CSS custom property overrides via a ThemeProvider wrapper. AI features hit OpenRouter's Gemma 3 27B via server-side API routes. Import uses JSON-LD parsing for blogs + AI parsing for Instagram captions. Sharing creates public read-only recipe pages.

**Tech Stack:** Next.js 16, React 19, Supabase, OpenRouter API (Gemma 3 27B free), CSS custom properties for themes

---

## Feature A: Holiday Themes + Custom Colors

### Task 1: Theme definitions

**Files:**
- Create: `src/lib/themes.ts`

**Step 1: Create theme data**

Create `src/lib/themes.ts` with all 7 theme definitions:

```ts
export type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  surface: string;
  border: string;
};

export type Theme = {
  id: string;
  name: string;
  colors: ThemeColors;
  decoration: "none" | "hearts" | "shamrocks" | "pumpkins" | "leaves" | "snowflakes" | "sparkles";
};

export const THEMES: Theme[] = [
  {
    id: "cottagecore",
    name: "Cottagecore",
    colors: {
      primary: "#f2b8c6",
      secondary: "#a67b5b",
      accent: "#a8bfa0",
      background: "#fff8f0",
      text: "#4a3728",
      surface: "#fffdfb",
      border: "#ebd8c8",
    },
    decoration: "none",
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    colors: {
      primary: "#e8355a",
      secondary: "#8b2252",
      accent: "#ffb6c1",
      background: "#fff0f3",
      text: "#4a1525",
      surface: "#fffbfc",
      border: "#f5c6d0",
    },
    decoration: "hearts",
  },
  {
    id: "stpatricks",
    name: "St. Patrick's Day",
    colors: {
      primary: "#2e8b57",
      secondary: "#daa520",
      accent: "#98fb98",
      background: "#f0fff0",
      text: "#1a3a2a",
      surface: "#f8fffa",
      border: "#b8dcc8",
    },
    decoration: "shamrocks",
  },
  {
    id: "halloween",
    name: "Halloween",
    colors: {
      primary: "#ff6b1a",
      secondary: "#9b59b6",
      accent: "#8b008b",
      background: "#1a1a2e",
      text: "#f0e6d3",
      surface: "#252540",
      border: "#3a3a5c",
    },
    decoration: "pumpkins",
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    colors: {
      primary: "#cc5500",
      secondary: "#8b4513",
      accent: "#daa520",
      background: "#fff8dc",
      text: "#3a2510",
      surface: "#fffdf5",
      border: "#e0c8a0",
    },
    decoration: "leaves",
  },
  {
    id: "christmas",
    name: "Christmas",
    colors: {
      primary: "#c41e3a",
      secondary: "#006400",
      accent: "#ffd700",
      background: "#fff8f0",
      text: "#2a1a1a",
      surface: "#fffdfb",
      border: "#e0c8c8",
    },
    decoration: "snowflakes",
  },
  {
    id: "newyears",
    name: "New Year's",
    colors: {
      primary: "#ffd700",
      secondary: "#c0c0c0",
      accent: "#ffd700",
      background: "#0d0d1a",
      text: "#e8e8f0",
      surface: "#1a1a2e",
      border: "#3a3a5c",
    },
    decoration: "sparkles",
  },
];

export const CUSTOM_COLORS = [
  { name: "Pink", hex: "#f2b8c6" },
  { name: "Rose", hex: "#e8355a" },
  { name: "Coral", hex: "#ff7f7f" },
  { name: "Brown", hex: "#a67b5b" },
  { name: "Sage", hex: "#a8bfa0" },
  { name: "Forest", hex: "#2e8b57" },
  { name: "Lavender", hex: "#b8a9d4" },
  { name: "Blue", hex: "#6b9fd4" },
  { name: "Gold", hex: "#daa520" },
];

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", theme.colors.primary);
  root.style.setProperty("--color-secondary", theme.colors.secondary);
  root.style.setProperty("--color-accent", theme.colors.accent);
  root.style.setProperty("--color-background", theme.colors.background);
  root.style.setProperty("--color-text", theme.colors.text);
  root.style.setProperty("--color-surface", theme.colors.surface);
  root.style.setProperty("--color-border", theme.colors.border);
}

export function applyCustomColor(hex: string) {
  document.documentElement.style.setProperty("--color-primary", hex);
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return THEMES[0];
  const id = localStorage.getItem("cookbook-theme") || "cottagecore";
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function getStoredCustomColor(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cookbook-custom-color");
}
```

**Step 2: Commit**

```bash
git add src/lib/themes.ts
git commit -m "added theme definitions"
```

---

### Task 2: ThemeProvider component

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create ThemeProvider**

Create `src/components/theme-provider.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getStoredTheme, getStoredCustomColor, applyTheme, applyCustomColor, type Theme } from "@/lib/themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [decoration, setDecoration] = useState<string>("none");

  useEffect(() => {
    const theme = getStoredTheme();
    applyTheme(theme);
    setDecoration(theme.decoration);

    const customColor = getStoredCustomColor();
    if (customColor) {
      applyCustomColor(customColor);
      setDecoration("none");
    }
  }, []);

  return (
    <>
      {children}
      {decoration !== "none" && <DecorationOverlay type={decoration} />}
    </>
  );
}

function DecorationOverlay({ type }: { type: string }) {
  const items = getDecorationItems(type);
  return (
    <div className="decoration-overlay">
      {items.map((item, i) => (
        <span
          key={i}
          className="decoration-item"
          style={{
            left: `${item.x}%`,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
            fontSize: `${item.size}rem`,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}

type DecoItem = { emoji: string; x: number; delay: number; duration: number; size: number };

function getDecorationItems(type: string): DecoItem[] {
  const emojiMap: Record<string, string> = {
    hearts: "\u2764\ufe0f",
    shamrocks: "\u2618\ufe0f",
    pumpkins: "\ud83c\udf83",
    leaves: "\ud83c\udf42",
    snowflakes: "\u2744\ufe0f",
    sparkles: "\u2728",
  };
  const emoji = emojiMap[type] || "\u2728";
  return Array.from({ length: 6 }, (_, i) => ({
    emoji,
    x: 10 + i * 15 + Math.random() * 10,
    delay: i * 1.5,
    duration: 8 + Math.random() * 4,
    size: 0.8 + Math.random() * 0.6,
  }));
}
```

**Step 2: Add decoration CSS**

In `src/app/globals.css`, add at the end:

```css
/* ── Theme decorations ─────────────────────────────────── */

.decoration-overlay {
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  position: fixed;
  z-index: 9999;
}

@keyframes decoration-fall {
  0% { opacity: 0; transform: translateY(-10vh) rotate(0deg); }
  10% { opacity: 0.6; }
  90% { opacity: 0.6; }
  100% { opacity: 0; transform: translateY(105vh) rotate(360deg); }
}

.decoration-item {
  animation: decoration-fall linear infinite;
  opacity: 0;
  position: absolute;
  top: 0;
}
```

**Step 3: Wrap layout with ThemeProvider**

In `src/app/layout.tsx`, add the import and wrap the body children:

```tsx
import { ThemeProvider } from "@/components/theme-provider";
```

Change the body contents from:
```tsx
<body className={`${nunito.variable} ${playfair.variable} ${dancingScript.variable}`}>{children}</body>
```
to:
```tsx
<body className={`${nunito.variable} ${playfair.variable} ${dancingScript.variable}`}>
  <ThemeProvider>{children}</ThemeProvider>
</body>
```

**Step 4: Verify**

Run: `npm run dev`
The app should load normally with the default cottagecore theme. No decorations should appear (default theme has `decoration: "none"`).

**Step 5: Commit**

```bash
git add src/components/theme-provider.tsx src/app/layout.tsx src/app/globals.css
git commit -m "added theme provider with decoration overlays"
```

---

### Task 3: Settings page — theme picker + custom colors

**Files:**
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Build the settings page**

Replace `src/app/settings/page.tsx` with:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { THEMES, CUSTOM_COLORS, applyTheme, applyCustomColor, type Theme } from "@/lib/themes";
import { useState } from "react";

export default function SettingsPage() {
  const [activeTheme, setActiveTheme] = useState(() => {
    if (typeof window === "undefined") return "cottagecore";
    return localStorage.getItem("cookbook-theme") || "cottagecore";
  });
  const [activeColor, setActiveColor] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("cookbook-custom-color");
  });

  function selectTheme(theme: Theme) {
    localStorage.setItem("cookbook-theme", theme.id);
    localStorage.removeItem("cookbook-custom-color");
    setActiveTheme(theme.id);
    setActiveColor(null);
    applyTheme(theme);
    window.location.reload();
  }

  function selectColor(hex: string) {
    localStorage.setItem("cookbook-custom-color", hex);
    setActiveColor(hex);
    applyCustomColor(hex);
  }

  function clearCustomColor() {
    localStorage.removeItem("cookbook-custom-color");
    setActiveColor(null);
    const theme = THEMES.find((t) => t.id === activeTheme) || THEMES[0];
    applyTheme(theme);
  }

  return (
    <AppShell>
      <section className="settings-page">
        <h1 className="section-title">Settings</h1>

        <div className="settings-section">
          <h2 className="settings-heading">Holiday Themes</h2>
          <div className="theme-grid">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`theme-card${activeTheme === theme.id && !activeColor ? " theme-card-active" : ""}`}
                onClick={() => selectTheme(theme)}
              >
                <div className="theme-swatches">
                  <span className="theme-swatch" style={{ background: theme.colors.primary }} />
                  <span className="theme-swatch" style={{ background: theme.colors.secondary }} />
                  <span className="theme-swatch" style={{ background: theme.colors.accent }} />
                  <span className="theme-swatch" style={{ background: theme.colors.background }} />
                </div>
                <span className="theme-name">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-heading">Custom Color</h2>
          <p className="settings-description">Override just the primary color without changing the full theme.</p>
          <div className="color-picker-row">
            {CUSTOM_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`color-swatch-btn${activeColor === c.hex ? " color-swatch-active" : ""}`}
                style={{ background: c.hex }}
                onClick={() => selectColor(c.hex)}
                title={c.name}
              />
            ))}
            {activeColor && (
              <button type="button" className="btn-secondary" onClick={clearCustomColor}>
                Reset
              </button>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
```

**Step 2: Add settings CSS**

In `src/app/globals.css`, add:

```css
/* ── Settings page ─────────────────────────────────────── */

.settings-page {
  max-width: 720px;
}

.settings-section {
  margin-top: 1.5rem;
}

.settings-heading {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.settings-description {
  color: var(--color-secondary);
  font-size: 0.85rem;
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
  font: inherit;
  gap: 0.5rem;
  padding: 0.75rem;
  transition: border-color 0.2s, transform 0.2s;
}

.theme-card:hover {
  transform: translateY(-2px);
}

.theme-card-active {
  border-color: var(--color-primary);
}

.theme-swatches {
  display: flex;
  gap: 4px;
}

.theme-swatch {
  border-radius: 50%;
  display: block;
  height: 24px;
  width: 24px;
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

.color-swatch-active {
  border-color: var(--color-text);
}
```

**Step 3: Verify**

Run: `npm run dev`
Navigate to `/settings`. Should see 7 theme cards with color swatches and a row of custom color circles. Clicking a theme should change the app's colors. Clicking Halloween should show pumpkin decorations falling.

**Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/app/globals.css
git commit -m "added theme picker and custom color settings"
```

---

## Feature B: AI Assistant

### Task 4: Chat API route

**Files:**
- Create: `src/app/api/chat/route.ts`

**Step 1: Create the chat endpoint**

Create `src/app/api/chat/route.ts`:

```ts
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
```

**Step 2: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "added chat api route with openrouter"
```

---

### Task 5: AI Assistant chat UI

**Files:**
- Modify: `src/app/ai-assistant/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Build the chat interface**

Replace `src/app/ai-assistant/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.reply || data.error || "Something went wrong" }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "Couldn't reach the assistant. Try again!" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p className="chat-empty-title">Hey Jizzy!</p>
              <p className="chat-empty-sub">Ask me anything about cooking, recipes, or meal ideas.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble chat-bubble-${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble chat-bubble-assistant chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form className="chat-input-bar" onSubmit={sendMessage}>
          <input
            type="text"
            className="chat-input"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary chat-send" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}
```

**Step 2: Add chat CSS**

In `src/app/globals.css`, add:

```css
/* ── AI Chat ───────────────────────────────────────────── */

.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  max-width: 720px;
}

.chat-messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  padding-bottom: 1rem;
}

.chat-empty {
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.chat-empty-title {
  font-family: var(--font-playfair), serif;
  font-size: 1.5rem;
}

.chat-empty-sub {
  color: var(--color-secondary);
  font-size: 0.92rem;
  margin-top: 0.25rem;
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
  align-self: flex-end;
  background: var(--color-primary);
  color: #fff;
}

.chat-bubble-assistant {
  align-self: flex-start;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.chat-typing {
  align-items: center;
  display: flex;
  gap: 4px;
  padding: 0.75rem 1.25rem;
}

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

.typing-dot {
  animation: typing-bounce 1.2s ease-in-out infinite;
  background: var(--color-secondary);
  border-radius: 50%;
  display: block;
  height: 6px;
  width: 6px;
}

.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.3s; }

.chat-input-bar {
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
}

.chat-input {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  flex: 1;
  font: inherit;
  font-size: 0.92rem;
  padding: 0.6rem 0.75rem;
}

.chat-input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.chat-send {
  border-radius: 0.5rem;
  min-width: 70px;
}
```

**Step 3: Verify**

Run: `npm run dev`
Navigate to `/ai-assistant`. Should see the empty state greeting. Type a message and send — if `OPENROUTER_API_KEY` is set in `.env.local`, you should get a response. If not set, you'll see the error message in a bubble.

**Step 4: Commit**

```bash
git add src/app/ai-assistant/page.tsx src/app/globals.css
git commit -m "added ai assistant chat ui"
```

---

## Feature C: Recipe Import

### Task 6: AI recipe parsing API route

**Files:**
- Create: `src/app/api/parse-recipe/route.ts`

**Step 1: Create the parse endpoint**

Create `src/app/api/parse-recipe/route.ts`:

```ts
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
    // Try to extract JSON from the response (may have markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ recipe: parsed });
  } catch {
    return NextResponse.json({ error: "Could not parse AI response", raw }, { status: 422 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/parse-recipe/route.ts
git commit -m "added ai recipe parsing api route"
```

---

### Task 7: Blog URL import API route

**Files:**
- Create: `src/app/api/import-recipe/route.ts`

**Step 1: Create the import endpoint**

Create `src/app/api/import-recipe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  // Check if it's an Instagram URL
  const isInstagram = /instagram\.com/.test(url);

  if (isInstagram) {
    // Try oEmbed API for caption
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

    // If oEmbed fails, tell the client to show the paste fallback
    return NextResponse.json({ type: "paste_fallback" });
  }

  // Blog URL — try to fetch and parse JSON-LD
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CuteCookbook/1.0)" },
    });

    if (!pageRes.ok) {
      return NextResponse.json({ error: "Could not fetch URL" }, { status: 400 });
    }

    const html = await pageRes.text();

    // Extract JSON-LD scripts
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        const content = match.replace(/<script[^>]*>|<\/script>/gi, "");
        try {
          let parsed = JSON.parse(content);

          // Handle @graph arrays
          if (parsed["@graph"]) {
            parsed = parsed["@graph"].find((item: any) =>
              item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
            );
          }

          // Handle arrays
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

    // No JSON-LD found — send page text for AI parsing fallback
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
```

**Step 2: Commit**

```bash
git add src/app/api/import-recipe/route.ts
git commit -m "added blog url import api with json-ld parsing"
```

---

### Task 8: Import modal component

**Files:**
- Create: `src/components/import-modal.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create the import modal**

Create `src/components/import-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportModalProps = {
  onClose: () => void;
};

export function ImportModal({ onClose }: ImportModalProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleImportUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.type === "paste_fallback") {
        setShowPaste(true);
        return;
      }

      if (data.type === "recipe") {
        // JSON-LD parsed successfully — go to new recipe form with prefill
        sessionStorage.setItem("import-recipe", JSON.stringify(data.recipe));
        router.push("/recipes/new?import=true");
        onClose();
        return;
      }

      if (data.type === "text") {
        // Need AI parsing
        await parseWithAI(data.text);
      }
    } catch {
      setError("Something went wrong. Try again!");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteText.trim() || loading) return;
    setLoading(true);
    setError("");
    await parseWithAI(pasteText.trim());
    setLoading(false);
  }

  async function parseWithAI(text: string) {
    try {
      const res = await fetch("/api/parse-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      sessionStorage.setItem("import-recipe", JSON.stringify(data.recipe));
      router.push("/recipes/new?import=true");
      onClose();
    } catch {
      setError("AI parsing failed. Try pasting the recipe manually!");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Import Recipe</h2>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleImportUrl}>
          <label className="form-label">
            Paste a URL (Instagram post or recipe blog)
            <input
              type="url"
              className="form-input"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading || !url.trim()} style={{ marginTop: "0.75rem", width: "100%" }}>
            {loading ? "Importing..." : "Import"}
          </button>
        </form>

        {showPaste && (
          <form onSubmit={handlePasteSubmit} style={{ marginTop: "1rem" }}>
            <p className="settings-description">
              We couldn&apos;t grab that automatically. Paste the recipe caption here:
            </p>
            <textarea
              className="form-textarea"
              rows={6}
              placeholder="Paste the recipe text here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              style={{ width: "100%" }}
            />
            <button type="submit" className="btn-primary" disabled={loading || !pasteText.trim()} style={{ marginTop: "0.5rem", width: "100%" }}>
              {loading ? "Parsing..." : "Parse with AI"}
            </button>
          </form>
        )}

        {error && <p className="import-error">{error}</p>}
      </div>
    </div>
  );
}
```

**Step 2: Add modal CSS**

In `src/app/globals.css`, add:

```css
/* ── Modal ─────────────────────────────────────────────── */

.modal-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 1000;
}

.modal-content {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  max-height: 80vh;
  max-width: 480px;
  overflow-y: auto;
  padding: 1.5rem;
  width: 90%;
}

.modal-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal-title {
  font-size: 1.1rem;
}

.modal-close {
  background: none;
  border: none;
  color: var(--color-secondary);
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;
}

.modal-close:hover {
  color: var(--color-text);
}
```

**Step 3: Add Import button to AppShell topbar**

In `src/components/app-shell.tsx`, add import and state:

Add at top: `import { ImportModal } from "@/components/import-modal";`

Add state inside component: `const [showImport, setShowImport] = useState(false);`

In the topbar, add a button before the "New Recipe" link:

Change this section:
```tsx
<Link href="/recipes/new" className="btn-primary">+ New Recipe</Link>
```
to:
```tsx
<button type="button" className="btn-secondary" onClick={() => setShowImport(true)}>Import</button>
<Link href="/recipes/new" className="btn-primary">+ New Recipe</Link>
```

And add the modal at the end of the component, just before the closing `</div>` of `app-shell`:

```tsx
{showImport && <ImportModal onClose={() => setShowImport(false)} />}
```

**Step 4: Verify**

Run: `npm run dev`
The topbar should show an "Import" button. Clicking it opens the import modal. Pasting a blog URL with JSON-LD should parse and redirect to `/recipes/new?import=true` (the recipe form will need to read from `sessionStorage` — that integration depends on the existing recipe form from Phase 3).

**Step 5: Commit**

```bash
git add src/components/import-modal.tsx src/components/app-shell.tsx src/app/globals.css
git commit -m "added import recipe modal with url and paste support"
```

---

## Feature D: Recipe Sharing

### Task 9: Public share page

**Files:**
- Create: `src/app/share/[id]/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create the share page**

Create `src/app/share/[id]/page.tsx`:

```tsx
"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  ingredients: any[];
  instructions: any[];
  notes: string | null;
  cook_time: number | null;
  prep_time: number | null;
  servings: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export default function SharePage() {
  const params = useParams();
  const recipeId = params.id as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchRecipe() {
      const { data } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", recipeId)
        .single();
      if (data) setRecipe(data as Recipe);
      setLoading(false);
    }
    fetchRecipe();
  }, [recipeId]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="share-page">
        <p className="empty-state-text">Loading recipe...</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="share-page">
        <p className="empty-state-text">Recipe not found</p>
      </div>
    );
  }

  const hasNutrition = recipe.calories || recipe.protein || recipe.carbs || recipe.fat;

  return (
    <div className="share-page">
      <article className="share-card">
        <div className="share-header">
          <h1 className="share-title">{recipe.title}</h1>
          <button type="button" className="btn-secondary" onClick={copyLink}>
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {recipe.cover_image_url && (
          <img src={recipe.cover_image_url} alt={recipe.title} className="share-hero" />
        )}

        <div className="share-meta">
          {recipe.prep_time && <span className="meta-chip">Prep: {recipe.prep_time}min</span>}
          {recipe.cook_time && <span className="meta-chip">Cook: {recipe.cook_time}min</span>}
          {recipe.servings && <span className="meta-chip">Serves {recipe.servings}</span>}
        </div>

        {recipe.ingredients.length > 0 && (
          <div className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Ingredients</h2>
            <ul className="share-ingredient-list">
              {recipe.ingredients.map((ing: any, i: number) => (
                <li key={i}>
                  {ing.amount && `${ing.amount} `}
                  {ing.unit && `${ing.unit} `}
                  {ing.name || ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {recipe.instructions.length > 0 && (
          <div className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Instructions</h2>
            <ol className="instruction-list">
              {recipe.instructions.map((step: any, i: number) => (
                <li key={i} className="instruction-step">{step.text || step}</li>
              ))}
            </ol>
          </div>
        )}

        {recipe.notes && (
          <div className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Notes</h2>
            <p className="recipe-notes-text">{recipe.notes}</p>
          </div>
        )}

        {hasNutrition && (
          <div className="nutrition-card">
            <p className="nutrition-title">Nutrition (per serving)</p>
            <div className="nutrition-grid">
              {recipe.calories && <div className="nutrition-item"><span className="nutrition-value">{recipe.calories}</span><span className="nutrition-label">cal</span></div>}
              {recipe.protein && <div className="nutrition-item"><span className="nutrition-value">{recipe.protein}g</span><span className="nutrition-label">protein</span></div>}
              {recipe.carbs && <div className="nutrition-item"><span className="nutrition-value">{recipe.carbs}g</span><span className="nutrition-label">carbs</span></div>}
              {recipe.fat && <div className="nutrition-item"><span className="nutrition-value">{recipe.fat}g</span><span className="nutrition-label">fat</span></div>}
            </div>
          </div>
        )}

        <p className="share-footer">Made with Jizzy's Cookbook</p>
      </article>
    </div>
  );
}
```

**Step 2: Add share page CSS**

In `src/app/globals.css`, add:

```css
/* ── Share page ────────────────────────────────────────── */

.share-page {
  align-items: center;
  background: var(--color-background);
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.share-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  box-shadow: 0 8px 32px rgba(74, 55, 40, 0.1);
  max-width: 640px;
  padding: 2rem;
  width: 100%;
}

.share-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.share-title {
  color: var(--color-text);
  font-family: var(--font-playfair), serif;
  font-size: 1.8rem;
}

.share-hero {
  border-radius: 0.25rem;
  display: block;
  max-height: 360px;
  object-fit: cover;
  width: 100%;
}

.share-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.share-ingredient-list {
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  font-size: 0.92rem;
  gap: 0.3rem;
  line-height: 1.5;
  padding-left: 1.25rem;
}

.share-footer {
  color: var(--color-secondary);
  font-family: var(--font-dancing), cursive;
  font-size: 0.92rem;
  margin-top: 2rem;
  text-align: center;
}
```

**Step 3: Verify**

Run: `npm run dev`
Navigate to `/share/[any-recipe-id]`. If you have a recipe in Supabase, it should render as a clean standalone page. If no recipe found, shows "Recipe not found". The "Copy Link" button should work.

**Step 4: Commit**

```bash
git add src/app/share/\\[id\\]/page.tsx src/app/globals.css
git commit -m "added public recipe share page"
```

---

### Task 10: Add share button to recipe detail page

**Files:**
- Modify: `src/app/recipes/[id]/page.tsx` (if it exists from Phase 3)

**Step 1: Add share button**

In the recipe detail page, find the actions section (where edit/delete buttons are) and add a share button:

```tsx
<button
  type="button"
  className="btn-secondary"
  onClick={() => {
    const shareUrl = `${window.location.origin}/share/${recipe.id}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Share link copied!");
  }}
>
  Share
</button>
```

If the recipe detail page doesn't exist yet (Phase 3 not complete), skip this task — the share page at `/share/[id]` works independently.

**Step 2: Commit**

```bash
git add src/app/recipes/\\[id\\]/page.tsx
git commit -m "added share button to recipe detail"
```

---

### Task 11: Final build check

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Fix any issues**

If there are type errors or lint issues, fix them and commit:

```bash
git add -A
git commit -m "phase 4 build fixes"
```

**Step 3: Push**

```bash
git push
```
