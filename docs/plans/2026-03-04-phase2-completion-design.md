# Phase 2 Completion Design

## Context

Phase 2 (Birthday Experience + Dashboard) is partially done. Birthday flow works (scenes 1-3, has_seen_birthday flag). What remains: wiring the dashboard to Supabase, category cards, search, revisit letter link, and fleshing out the recipes/favorites pages.

Love letter content is left as a placeholder for the user to fill in.

## Decisions

- **Data fetching:** Direct Supabase queries in components via a shared client (`src/lib/supabase.ts`). No hooks abstraction yet.
- **Search scope:** Title-only for Phase 2.
- **Category navigation:** Clicking a category card navigates to `/categories/[id]` showing filtered recipes.
- **Revisit letter:** Small card on the dashboard linking to the love letter page.
- **Empty states:** Friendly messages when no data exists (empty database).

## Design

### 1. Supabase Client Setup

- Install `@supabase/supabase-js`
- Create `src/lib/supabase.ts` — singleton browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Dashboard — Recent Recipes

- Replace hardcoded `RECENT_RECIPES` with live query: `recipes` table, ordered by `created_at desc`, limit 6
- Join `recipe_categories` + `categories` to show category tags on cards
- Empty state: "No recipes yet — add your first one!" with link to add recipe

### 3. Dashboard — Favorites

- Replace hardcoded `FAVORITES` with live query: `recipes` where `is_favorite = true`, limit 6
- Empty state: "Heart a recipe to see it here"

### 4. Dashboard — Category Cards

- New section below Favorites
- Query `categories` table for all categories (seeded "Desserts" + any user-created)
- Each card: emoji + name, clickable
- Navigates to `/categories/[id]`

### 5. Category Detail Page

- New route: `/categories/[id]/page.tsx`
- Fetch category name/emoji + recipes via `recipe_categories` junction table
- Display recipes in same card grid as dashboard
- Empty state: "No recipes in this category yet."

### 6. Search Bar

- Wire up existing `<input type="search">` in topbar
- On typing, query `recipes` with `ilike('title', '%query%')`
- Show results as a dropdown overlay under search bar
- Each result shows recipe title + category tag
- No navigation on click yet (recipe detail pages are Phase 3)

### 7. Revisit Letter Link

- Small card at bottom of dashboard: "Read your letter"
- Navigates to `/letter` route that renders the `BirthdayLoveLetter` component standalone
- Create `/letter/page.tsx`

### 8. Recipes Page

- Update `/recipes/page.tsx` to show all recipes in a grid
- Same card style as dashboard
- Empty state when no recipes

### 9. Favorites Page

- Update `/favorites/page.tsx` to show favorited recipes in a grid
- Same card style as dashboard
- Empty state when no favorites

## Files to Create/Modify

**New files:**
- `src/lib/supabase.ts`
- `src/app/categories/[id]/page.tsx`
- `src/app/letter/page.tsx`

**Modified files:**
- `package.json` (add @supabase/supabase-js)
- `src/app/page.tsx` (dashboard — replace hardcoded data with Supabase queries, add categories section, add letter link)
- `src/components/app-shell.tsx` (search functionality)
- `src/app/recipes/page.tsx` (real recipe list)
- `src/app/favorites/page.tsx` (real favorites list)
- `src/app/categories/page.tsx` (list all categories)
- `src/app/globals.css` (styles for new elements: search dropdown, category cards, empty states)
