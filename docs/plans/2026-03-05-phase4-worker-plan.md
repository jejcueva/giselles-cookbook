# Phase 4 Worker Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 independent features to the cookbook app: holiday themes, AI assistant, recipe import, and recipe sharing.

**Architecture:** 4 independent feature tracks that can be worked on in parallel by separate workers. Each track creates its own files and only touches `globals.css` for its own CSS section (append-only, no conflicts). The one shared modification is `layout.tsx` (themes track) and `app-shell.tsx` (import track) — all other work is in new files.

**Tech Stack:** Next.js 16, React 19, Supabase, OpenRouter API (Gemma 3 27B free), CSS custom properties

---

## Worker Assignments

| Worker | Feature | Files Created | Files Modified | Can Run In Parallel |
|--------|---------|--------------|----------------|-------------------|
| A | Holiday Themes + Custom Colors | `src/lib/themes.ts`, `src/components/theme-provider.tsx` | `src/app/layout.tsx`, `src/app/settings/page.tsx`, `src/app/globals.css` | Yes |
| B | AI Assistant | `src/app/api/chat/route.ts` | `src/app/ai-assistant/page.tsx`, `src/app/globals.css` | Yes |
| C | Recipe Import | `src/app/api/parse-recipe/route.ts`, `src/app/api/import-recipe/route.ts`, `src/components/import-modal.tsx` | `src/components/app-shell.tsx`, `src/app/globals.css` | Yes |
| D | Recipe Sharing | `src/app/share/[id]/page.tsx` | `src/app/globals.css` | Yes |

**CSS conflict note:** Each worker appends a clearly labeled section to `globals.css`. As long as each worker adds to the END of the file with a unique section comment header, there will be no merge conflicts.

---

## Worker A: Holiday Themes + Custom Colors

**Objective:** Build a theme system with 7 holiday presets, decorative overlays, and a custom primary color picker in settings.

**Prerequisite env vars:** None

### Task A1: Theme definitions and utilities

**Create:** `src/lib/themes.ts`

This file exports:
- `Theme` and `ThemeColors` types
- `THEMES` array — 7 theme objects, each with: `id`, `name`, `colors` (primary, secondary, accent, background, text, surface, border), and `decoration` (string key: "none" | "hearts" | "shamrocks" | "pumpkins" | "leaves" | "snowflakes" | "sparkles")
- `CUSTOM_COLORS` array — 9 color swatches: Pink `#f2b8c6`, Rose `#e8355a`, Coral `#ff7f7f`, Brown `#a67b5b`, Sage `#a8bfa0`, Forest `#2e8b57`, Lavender `#b8a9d4`, Blue `#6b9fd4`, Gold `#daa520`
- `applyTheme(theme)` — sets all 7 CSS vars on `document.documentElement`
- `applyCustomColor(hex)` — sets only `--color-primary`
- `getStoredTheme()` — reads `localStorage("cookbook-theme")`, returns matching theme or default
- `getStoredCustomColor()` — reads `localStorage("cookbook-custom-color")`, returns hex or null

Theme color values:

| Theme | primary | secondary | accent | background | text | surface | border | decoration |
|-------|---------|-----------|--------|------------|------|---------|--------|------------|
| cottagecore | #f2b8c6 | #a67b5b | #a8bfa0 | #fff8f0 | #4a3728 | #fffdfb | #ebd8c8 | none |
| valentines | #e8355a | #8b2252 | #ffb6c1 | #fff0f3 | #4a1525 | #fffbfc | #f5c6d0 | hearts |
| stpatricks | #2e8b57 | #daa520 | #98fb98 | #f0fff0 | #1a3a2a | #f8fffa | #b8dcc8 | shamrocks |
| halloween | #ff6b1a | #9b59b6 | #8b008b | #1a1a2e | #f0e6d3 | #252540 | #3a3a5c | pumpkins |
| thanksgiving | #cc5500 | #8b4513 | #daa520 | #fff8dc | #3a2510 | #fffdf5 | #e0c8a0 | leaves |
| christmas | #c41e3a | #006400 | #ffd700 | #fff8f0 | #2a1a1a | #fffdfb | #e0c8c8 | snowflakes |
| newyears | #ffd700 | #c0c0c0 | #ffd700 | #0d0d1a | #e8e8f0 | #1a1a2e | #3a3a5c | sparkles |

**Commit:** `git commit -m "added theme definitions"`

### Task A2: ThemeProvider component with decoration overlays

**Create:** `src/components/theme-provider.tsx`
**Modify:** `src/app/layout.tsx`

ThemeProvider is a `"use client"` component that:
1. On mount, reads stored theme and custom color from localStorage
2. Calls `applyTheme()` and optionally `applyCustomColor()`
3. Renders children + a `DecorationOverlay` if the theme's decoration is not "none"

DecorationOverlay renders 6 emoji items in a fixed overlay (`pointer-events: none`, `z-index: 9999`). Each item has:
- The decoration emoji (hearts=❤️, shamrocks=☘️, pumpkins=🎃, leaves=🍂, snowflakes=❄️, sparkles=✨)
- Random horizontal position (`left: 10% + i*15% + random*10%`)
- Staggered `animation-delay` (i * 1.5s)
- Random `animation-duration` (8-12s)
- Random `font-size` (0.8-1.4rem)
- CSS animation `decoration-fall`: starts above viewport, fades in, drifts down to below viewport with rotation, fades out. Loops infinitely.

In `layout.tsx`, wrap `{children}` with `<ThemeProvider>{children}</ThemeProvider>`.

**Append to `globals.css`:**

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

**Commit:** `git commit -m "added theme provider with decoration overlays"`

### Task A3: Settings page with theme picker and custom colors

**Modify:** `src/app/settings/page.tsx` (replace placeholder entirely)

Build a `"use client"` page inside `<AppShell>` with:

1. **Holiday Themes** section — grid of 7 theme cards (`grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))`). Each card shows 4 color swatches (primary, secondary, accent, background) and the theme name. Active theme card gets a highlighted border. Clicking a card calls `applyTheme()`, saves to localStorage, and reloads the page (to re-render decorations).

2. **Custom Color** section — row of 9 circular color swatch buttons (36px). Clicking one calls `applyCustomColor()` and saves to localStorage. Active swatch gets a border. A "Reset" button appears when a custom color is active, which removes it and restores the theme default.

**Append to `globals.css`:**

```css
/* ── Settings page ─────────────────────────────────────── */
```

Settings CSS includes: `.settings-page`, `.settings-section`, `.settings-heading`, `.settings-description`, `.theme-grid`, `.theme-card`, `.theme-card-active`, `.theme-swatches`, `.theme-swatch`, `.theme-name`, `.color-picker-row`, `.color-swatch-btn`, `.color-swatch-active`

**Commit:** `git commit -m "added theme picker and custom color settings"`

---

## Worker B: AI Assistant

**Objective:** Build a recipe-aware cooking chatbot using OpenRouter's Gemma 3 27B.

**Prerequisite env vars:** `OPENROUTER_API_KEY` in `.env.local`

### Task B1: Chat API route

**Create:** `src/app/api/chat/route.ts`

POST endpoint that:
1. Reads `OPENROUTER_API_KEY` from `process.env` (NOT `NEXT_PUBLIC`)
2. Receives `{ messages }` from request body (array of `{ role, content }`)
3. Creates a server-side Supabase client and fetches up to 50 recipe titles + ingredient names for context
4. Builds a system prompt: "You are Jizzy's personal cooking assistant..." with the recipe list
5. Calls `https://openrouter.ai/api/v1/chat/completions` with model `google/gemma-3-27b-it:free`, the system prompt, and the messages array
6. Returns `{ reply }` with the assistant's response text
7. Error handling: returns `{ error }` with appropriate status codes if API key missing (500) or OpenRouter fails (502)

**Commit:** `git commit -m "added chat api route with openrouter"`

### Task B2: AI Assistant chat UI

**Modify:** `src/app/ai-assistant/page.tsx` (replace placeholder entirely)

Build a `"use client"` page inside `<AppShell>` with:

1. **State:** `messages` array of `{ role: "user" | "assistant", content: string }`, `input` string, `loading` boolean
2. **Layout:** `chat-container` fills available height (`calc(100vh - 120px)`), with scrollable `chat-messages` area and a fixed `chat-input-bar` at the bottom
3. **Empty state:** When no messages, show centered "Hey Jizzy!" greeting with "Ask me anything about cooking, recipes, or meal ideas."
4. **User messages:** Right-aligned pink bubbles (`.chat-bubble-user`)
5. **Assistant messages:** Left-aligned cream bubbles with border (`.chat-bubble-assistant`)
6. **Loading indicator:** Three bouncing dots animation (`.chat-typing`)
7. **Input bar:** Text input + "Send" button. Disabled while loading. On submit, appends user message, calls `/api/chat`, appends assistant response.
8. **Auto-scroll:** `useRef` on bottom div, scroll into view on new messages

**Append to `globals.css`:**

```css
/* ── AI Chat ───────────────────────────────────────────── */
```

Chat CSS includes: `.chat-container`, `.chat-messages`, `.chat-empty`, `.chat-empty-title`, `.chat-empty-sub`, `.chat-bubble`, `.chat-bubble-user`, `.chat-bubble-assistant`, `.chat-typing`, `@keyframes typing-bounce`, `.typing-dot`, `.chat-input-bar`, `.chat-input`, `.chat-send`

**Commit:** `git commit -m "added ai assistant chat ui"`

---

## Worker C: Recipe Import

**Objective:** Build a unified import flow for blog URLs (JSON-LD) and Instagram captions (AI parsing).

**Prerequisite env vars:** `OPENROUTER_API_KEY` in `.env.local`

### Task C1: AI recipe parsing API route

**Create:** `src/app/api/parse-recipe/route.ts`

POST endpoint that:
1. Receives `{ text }` — the raw recipe text (from IG caption or blog page fallback)
2. Sends to OpenRouter Gemma 3 27B with a system prompt that instructs it to return ONLY valid JSON with fields: `title`, `ingredients` (array of `{name, amount, unit}`), `instructions` (array of `{step_number, text}`), `cook_time`, `prep_time`, `servings`
3. Parses the AI response — uses regex `/{[\s\S]*}/` to extract JSON even if wrapped in markdown
4. Returns `{ recipe }` with the parsed object
5. Error handling: 400 if no text, 500 if no API key, 502 if AI fails, 422 if JSON parsing fails

**Commit:** `git commit -m "added ai recipe parsing api route"`

### Task C2: Blog URL import API route

**Create:** `src/app/api/import-recipe/route.ts`

POST endpoint that:
1. Receives `{ url }` — the URL to import from
2. Detects Instagram URLs via regex `/instagram\.com/`
3. **Instagram path:** Try oEmbed API (`https://api.instagram.com/oembed?url=...`) for caption. If it works, return `{ type: "text", text: caption }`. If it fails, return `{ type: "paste_fallback" }` telling the client to show a paste textarea.
4. **Blog URL path:** Fetch the page HTML. Search for `<script type="application/ld+json">` tags. Parse each one looking for a `@type: "Recipe"` object (handle `@graph` arrays too). If found, extract title, ingredients (`recipeIngredient`), instructions (`recipeInstructions`), cook/prep time (parse ISO 8601 duration `PT30M`), servings (`recipeYield`), nutrition, cover image. Return `{ type: "recipe", recipe }`.
5. **Blog fallback:** If no JSON-LD Recipe found, strip HTML tags, truncate to 4000 chars, return `{ type: "text", text }` for AI parsing.

**Commit:** `git commit -m "added blog url import api with json-ld parsing"`

### Task C3: Import modal and AppShell integration

**Create:** `src/components/import-modal.tsx`
**Modify:** `src/components/app-shell.tsx`

Import modal component:
1. Full-screen overlay (`.modal-overlay`) with centered card (`.modal-content`, max-width 480px)
2. URL input field + "Import" button
3. On submit, calls `/api/import-recipe`
4. If response is `type: "recipe"` — saves to `sessionStorage("import-recipe")` and navigates to `/recipes/new?import=true`
5. If response is `type: "text"` — calls `/api/parse-recipe` with the text, then saves result and navigates
6. If response is `type: "paste_fallback"` — shows a textarea for manual paste, with a "Parse with AI" button that calls `/api/parse-recipe`
7. Error states shown inline

AppShell modification:
1. Add `import { ImportModal } from "@/components/import-modal"`
2. Add `showImport` state
3. Add `<button className="btn-secondary" onClick={() => setShowImport(true)}>Import</button>` in the topbar before the "New Recipe" link
4. Render `{showImport && <ImportModal onClose={() => setShowImport(false)} />}` at the end of the component

**Append to `globals.css`:**

```css
/* ── Modal ─────────────────────────────────────────────── */
```

Modal CSS includes: `.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-title`, `.modal-close`

**Commit:** `git commit -m "added import recipe modal with url and paste support"`

---

## Worker D: Recipe Sharing

**Objective:** Create a public read-only recipe page anyone can view without logging in.

**Prerequisite env vars:** None

### Task D1: Public share page

**Create:** `src/app/share/[id]/page.tsx`

A `"use client"` page that:
1. Does NOT use `<AppShell>` — it's a standalone page, no sidebar, no auth check
2. Reads recipe ID from `useParams()`
3. Fetches full recipe from Supabase (`select("*")`)
4. Renders a centered card (`.share-card`, max-width 640px) with:
   - Title + "Copy Link" button in header
   - Cover image (if exists)
   - Meta chips (prep time, cook time, servings)
   - Ingredients as a bullet list
   - Instructions as numbered list
   - Notes section
   - Nutrition card (if any nutrition data exists)
   - Footer: "Made with Jizzy's Cookbook" in Dancing Script font
5. "Copy Link" button uses `navigator.clipboard.writeText(window.location.href)` and shows "Copied!" for 2 seconds
6. Loading state and "Recipe not found" state

**Append to `globals.css`:**

```css
/* ── Share page ────────────────────────────────────────── */
```

Share CSS includes: `.share-page`, `.share-card`, `.share-header`, `.share-title`, `.share-hero`, `.share-meta`, `.share-ingredient-list`, `.share-footer`

**Commit:** `git commit -m "added public recipe share page"`

### Task D2: Share button on recipe detail page

**Modify:** `src/app/recipes/[id]/page.tsx`

Add a "Share" button in the recipe detail actions section. On click, it copies `${window.location.origin}/share/${recipe.id}` to clipboard and shows a brief "Copied!" confirmation.

If `src/app/recipes/[id]/page.tsx` doesn't exist yet (Phase 3 not complete), skip this task.

**Commit:** `git commit -m "added share button to recipe detail"`

---

## Post-Worker: Integration Check

After all workers complete:

1. Run `npm run build` — fix any type/lint errors
2. Test each feature manually in dev
3. Commit fixes: `git commit -m "phase 4 build fixes"`
4. Push: `git push`
