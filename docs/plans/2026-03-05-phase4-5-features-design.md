# Phase 4-5 Features Design

## Context

Phase 2 (dashboard + Supabase wiring) and Phase 3 (recipe CRUD + blog URL import) are done or planned. This design covers the remaining features to bring the app to a polished, feature-complete state.

## Features

### 1. Recipe Import (Instagram + Blog URLs)

**Unified import flow:**
- "Import Recipe" button opens a modal with a single URL input field
- Backend detects if it's an Instagram or blog URL

**Blog URL flow:**
- Next.js API route `/api/import-recipe` fetches page HTML
- Parses JSON-LD `schema.org/Recipe` structured data (most recipe blogs have this)
- Extracts: title, ingredients, instructions, cook time, servings, nutrition
- Fallback: if no JSON-LD found, sends page text to Gemma 3 27B for AI parsing

**Instagram flow:**
- API route attempts to fetch IG post data (oEmbed API or page scrape for caption)
- If scraping fails (IG blocks), the modal shows a fallback textarea: "Paste the caption here"
- Caption text goes to Gemma 3 27B at `/api/parse-recipe` which returns structured JSON
- System prompt: "Extract recipe from this text. Return JSON with title, ingredients (array of {name, amount, unit}), instructions (array of steps), cook_time, servings."

**Both flows end the same way:**
- Parsed result pre-fills the Add Recipe form
- She reviews, edits, then saves
- No photo is grabbed from IG — she adds her own

### 2. AI Assistant

**UI:**
- Chat interface on `/ai-assistant` page
- Message list + input box
- Her messages: right-aligned, pink bubble
- AI responses: left-aligned, cream/white bubble
- Cottagecore styled (rounded corners, soft colors)

**Backend:**
- API route `/api/chat`
- Receives: user message + conversation history
- Fetches her recipe titles + ingredient names from Supabase (lightweight context)
- Sends to OpenRouter Gemma 3 27B at `https://openrouter.ai/api/v1/chat/completions`
- System prompt: "You are Jizzy's personal cooking assistant. You're warm, friendly, and helpful. Here are her saved recipes: [list]. Help with cooking questions, suggest recipes, give tips."
- No streaming for v1 — loading spinner while waiting for full response
- `OPENROUTER_API_KEY` in env vars (server-side only)

**Capabilities:**
- Recipe Q&A (substitutions, techniques)
- Recipe suggestions from her saved collection
- General cooking advice and meal planning
- Conversation history in React state (not persisted — fresh chat each visit)

### 3. Holiday Themes + Custom Colors

**7 preset holiday themes:**

| Theme | Primary | Secondary | Accent | Background | Decorations |
|-------|---------|-----------|--------|------------|-------------|
| Default Cottagecore | #F2B8C6 (pink) | #A67B5B (brown) | #A8BFA0 (sage) | #FFF8F0 (cream) | Sunflowers (existing) |
| Valentine's Day | #E8355A | #8B2252 | #FFB6C1 | #FFF0F3 | Floating hearts |
| St. Patrick's Day | #2E8B57 | #DAA520 | #98FB98 | #F0FFF0 | Shamrock accents |
| Halloween | #FF6B1A | #2D1B69 | #8B008B | #1A1A2E | Pumpkins, spider webs |
| Thanksgiving | #CC5500 | #8B4513 | #DAA520 | #FFF8DC | Autumn leaves |
| Christmas | #C41E3A | #006400 | #FFD700 | #FFF8F0 | Falling snowflakes |
| New Year's | #1A1A2E | #FFD700 | #C0C0C0 | #0D0D1A | Sparkles/confetti |

**Custom primary color picker:**
- Row of color swatches in settings (pink, brown, sage, lavender, blue, coral, etc.)
- Clicking a swatch overrides `--color-primary` across the app
- No holiday decorations with custom colors — just the color swap
- Independent of holiday themes (picking a holiday theme resets the custom color)

**Implementation:**
- Each theme is a JS object: `{ name, colors: { primary, secondary, accent, background, text, surface, border }, Decoration: ReactComponent | null }`
- Selected theme stored in `localStorage` key `cookbook-theme`
- On load, apply theme's CSS vars to `:root`, render decoration overlay
- Custom color stored separately in `localStorage` key `cookbook-custom-color`
- Settings page: grid of theme preview cards (small color swatches + name) + custom color row

**Decorations:**
- Lightweight CSS animations or small SVG elements
- Fixed overlay, `pointer-events: none`, low opacity
- Examples: 3-5 snowflakes drifting slowly, a few hearts floating up, scattered leaves
- Performance-conscious — no heavy particle systems

### 4. Recipe Sharing

- "Share" button on recipe detail page
- Generates public URL: `/share/[recipe-id]`
- `/share/[id]` is a read-only page — no auth required, no AppShell wrapper
- Shows: title, cover image, ingredients, instructions, notes, nutrition
- "Copy link" button copies URL to clipboard
- Styled standalone with cottagecore aesthetic
- Supabase RLS: the `share` route reads recipes without auth (public select policy needed)

### 5. Mobile Polish + Micro-interactions

**Mobile responsiveness (priority):**
- Sidebar becomes a bottom tab bar on mobile (Dashboard, Recipes, Categories, Favorites)
- Or: hamburger menu drawer that slides in from left
- Recipe cards stack in single column on small screens
- Search bar goes full-width
- Topbar buttons scale down appropriately
- Min 44px touch targets everywhere
- Test on iPhone SE (smallest common screen) up to iPad

**Micro-interactions:**
- Heart animation on favorite toggle (scale pop + color fill)
- Card hover lift effects (already partially done)
- Loading skeletons replacing "Loading..." text
- Subtle page transition fades
- Button press feedback (scale down slightly on active)
- Search dropdown appearance animation (slide down + fade)

## Files Overview

**New files:**
- `src/app/api/import-recipe/route.ts` — blog URL scrape + JSON-LD parse
- `src/app/api/parse-recipe/route.ts` — AI recipe parsing via OpenRouter
- `src/app/api/chat/route.ts` — AI assistant chat endpoint
- `src/app/share/[id]/page.tsx` — public recipe share page
- `src/lib/themes.ts` — theme definitions + decoration components
- `src/components/theme-provider.tsx` — applies theme on load
- `src/components/chat-message.tsx` — chat bubble component
- `src/components/import-modal.tsx` — import recipe modal
- `src/components/decorations/*.tsx` — holiday decoration overlays

**Modified files:**
- `src/app/ai-assistant/page.tsx` — full chat UI
- `src/app/settings/page.tsx` — theme picker + custom color picker
- `src/components/app-shell.tsx` — mobile responsive layout, import button
- `src/app/globals.css` — mobile breakpoints, animations, chat styles, theme transitions
- `src/app/layout.tsx` — wrap with ThemeProvider

## Open Questions for Implementation

- Do we need a Supabase `theme_preference` column on profiles, or is localStorage enough?
- Should the share page have OG meta tags for nice link previews when shared on social?
- For IG scraping: try oEmbed first (`https://api.instagram.com/oembed?url=...`) — it returns caption text without auth for public posts
