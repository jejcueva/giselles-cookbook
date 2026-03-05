# Phase 2 Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the dashboard, recipes, favorites, and categories pages to Supabase. Add search, category detail pages, and a revisit-letter link.

**Architecture:** Direct Supabase queries in `"use client"` components using a shared browser client from `src/lib/supabase.ts`. No custom hooks layer. All pages follow existing patterns: wrap content in `<AppShell>`, use CSS classes from `globals.css`.

**Tech Stack:** Next.js 16, React 19, Supabase JS v2, Tailwind CSS v4, existing vanilla CSS classes

---

### Task 1: Install Supabase and create client

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase.ts`

**Step 1: Install @supabase/supabase-js**

Run: `npm install @supabase/supabase-js`

**Step 2: Create Supabase client**

Create `src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 3: Verify it builds**

Run: `npm run build`
Expected: Build succeeds with no errors related to supabase import.

**Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts
git commit -m "added supabase client"
```

---

### Task 2: Dashboard — Recent Recipes from Supabase

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace hardcoded RECENT_RECIPES with Supabase query**

In `src/app/page.tsx`:

1. Remove the `RECENT_RECIPES` const array (lines 6-13)
2. Add imports: `import { supabase } from "@/lib/supabase";`
3. Add state and effect to fetch recent recipes:

```tsx
type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  created_at: string;
  category_name: string | null;
};

// Inside Home component, replace the existing useState/useEffect block:
const [time, setTime] = useState("morning");
const [recipes, setRecipes] = useState<Recipe[]>([]);
const [loadingRecipes, setLoadingRecipes] = useState(true);

useEffect(() => {
  setTime(getTimeOfDay());

  async function fetchRecent() {
    const { data } = await supabase
      .from("recipes")
      .select("id, title, cover_image_url, created_at, recipe_categories(categories(name))")
      .order("created_at", { ascending: false })
      .limit(6);

    if (data) {
      setRecipes(
        data.map((r: any) => ({
          id: r.id,
          title: r.title,
          cover_image_url: r.cover_image_url,
          created_at: r.created_at,
          category_name: r.recipe_categories?.[0]?.categories?.name ?? null,
        }))
      );
    }
    setLoadingRecipes(false);
  }
  fetchRecent();
}, []);
```

4. Update the Recent Recipes JSX section to use `recipes` state:

```tsx
<section className="dashboard-section">
  <h2 className="section-title">Recent Recipes</h2>
  {loadingRecipes ? (
    <p className="empty-state-text">Loading...</p>
  ) : recipes.length === 0 ? (
    <div className="empty-state">
      <p className="empty-state-text">No recipes yet — add your first one!</p>
    </div>
  ) : (
    <div className="recipe-grid">
      {recipes.map((recipe) => (
        <article key={recipe.id} className="recipe-card">
          <div className="recipe-info">
            <span className="recipe-name">{recipe.title}</span>
            {recipe.category_name && (
              <span className="recipe-tag">{recipe.category_name}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )}
</section>
```

**Step 2: Add empty state CSS**

In `src/app/globals.css`, add after the `.favorite-name` block (~line 641):

```css
/* ── Empty states ─────────────────────────────────────── */

.empty-state {
  align-items: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 0.25rem;
  display: flex;
  justify-content: center;
  padding: 2rem 1.5rem;
}

.empty-state-text {
  color: var(--color-secondary);
  font-size: 0.92rem;
  text-align: center;
}
```

**Step 3: Verify**

Run: `npm run dev`
Visit `http://localhost:3000` — should see "No recipes yet — add your first one!" in a dashed border box where hardcoded recipes used to be.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "wired recent recipes to supabase"
```

---

### Task 3: Dashboard — Favorites from Supabase

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace hardcoded FAVORITES with Supabase query**

1. Remove the `FAVORITES` const array (lines ~15-20 after Task 2 edits)
2. Add favorites state and fetch in the same `useEffect`:

```tsx
const [favorites, setFavorites] = useState<Recipe[]>([]);
const [loadingFavorites, setLoadingFavorites] = useState(true);

// Inside the existing useEffect, add after fetchRecent():
async function fetchFavorites() {
  const { data } = await supabase
    .from("recipes")
    .select("id, title, cover_image_url")
    .eq("is_favorite", true)
    .limit(6);

  if (data) {
    setFavorites(
      data.map((r: any) => ({
        id: r.id,
        title: r.title,
        cover_image_url: r.cover_image_url,
        created_at: "",
        category_name: null,
      }))
    );
  }
  setLoadingFavorites(false);
}
fetchFavorites();
```

3. Update the Favorites JSX section:

```tsx
<section className="dashboard-section">
  <h2 className="section-title">Favorites</h2>
  {loadingFavorites ? (
    <p className="empty-state-text">Loading...</p>
  ) : favorites.length === 0 ? (
    <div className="empty-state">
      <p className="empty-state-text">Heart a recipe to see it here</p>
    </div>
  ) : (
    <div className="favorites-row">
      {favorites.map((fav) => (
        <article key={fav.id} className="favorite-card">
          <span className="favorite-name">{fav.title}</span>
        </article>
      ))}
    </div>
  )}
</section>
```

**Step 2: Verify**

Run: `npm run dev`
Dashboard should show "Heart a recipe to see it here" in the Favorites section.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "wired favorites to supabase"
```

---

### Task 4: Dashboard — Category Cards + Categories Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/categories/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add Categories section to dashboard**

In `src/app/page.tsx`, add category state and fetch:

```tsx
type Category = {
  id: string;
  name: string;
  emoji: string | null;
};

const [categories, setCategories] = useState<Category[]>([]);

// Inside useEffect, add:
async function fetchCategories() {
  const { data } = await supabase
    .from("categories")
    .select("id, name, emoji")
    .order("name");

  if (data) setCategories(data);
}
fetchCategories();
```

Add `import Link from "next/link";` at the top.

Add JSX after the Favorites section:

```tsx
<section className="dashboard-section">
  <h2 className="section-title">Categories</h2>
  <div className="category-grid">
    {categories.map((cat) => (
      <Link key={cat.id} href={`/categories/${cat.id}`} className="category-card">
        {cat.emoji && <span className="category-emoji">{cat.emoji}</span>}
        <span className="category-label">{cat.name}</span>
      </Link>
    ))}
  </div>
</section>
```

**Step 2: Add category card CSS**

In `src/app/globals.css`, add after the empty state styles:

```css
/* ── Category cards ───────────────────────────────────── */

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.category-card {
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  text-decoration: none;
  transition: box-shadow 0.2s, transform 0.2s;
}

.category-card:hover {
  box-shadow: 0 4px 16px rgba(74, 55, 40, 0.08);
  transform: translateY(-2px);
}

.category-emoji {
  font-size: 1.3rem;
}

.category-label {
  color: var(--color-text);
  font-size: 0.92rem;
  font-weight: 700;
  white-space: nowrap;
}
```

**Step 3: Update categories list page**

Replace `src/app/categories/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  emoji: string | null;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("categories")
        .select("id, name, emoji")
        .order("name");
      if (data) setCategories(data);
    }
    fetch();
  }, []);

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">Categories</h1>
        {categories.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No categories yet</p>
          </div>
        ) : (
          <div className="category-grid">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.id}`} className="category-card">
                {cat.emoji && <span className="category-emoji">{cat.emoji}</span>}
                <span className="category-label">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
```

**Step 4: Verify**

Run: `npm run dev`
Dashboard should show a "Categories" section with the seeded "Desserts" card (with cake emoji). The /categories page should show the same. Clicking the card should navigate to /categories/[id] (will 404 for now — that's Task 5).

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/categories/page.tsx src/app/globals.css
git commit -m "added category cards to dashboard and categories page"
```

---

### Task 5: Category Detail Page

**Files:**
- Create: `src/app/categories/[id]/page.tsx`

**Step 1: Create category detail route**

Create `src/app/categories/[id]/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
};

type Category = {
  id: string;
  name: string;
  emoji: string | null;
};

export default function CategoryDetailPage() {
  const params = useParams();
  const categoryId = params.id as string;
  const [category, setCategory] = useState<Category | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [catResult, recipesResult] = await Promise.all([
        supabase.from("categories").select("id, name, emoji").eq("id", categoryId).single(),
        supabase
          .from("recipe_categories")
          .select("recipes(id, title, cover_image_url)")
          .eq("category_id", categoryId),
      ]);

      if (catResult.data) setCategory(catResult.data);
      if (recipesResult.data) {
        setRecipes(
          recipesResult.data
            .map((rc: any) => rc.recipes)
            .filter(Boolean)
        );
      }
      setLoading(false);
    }
    fetchData();
  }, [categoryId]);

  if (loading) {
    return (
      <AppShell>
        <p className="empty-state-text">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">
          {category?.emoji && `${category.emoji} `}{category?.name ?? "Category"}
        </h1>
        {recipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No recipes in this category yet.</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <article key={recipe.id} className="recipe-card">
                <div className="recipe-info">
                  <span className="recipe-name">{recipe.title}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
```

**Step 2: Verify**

Run: `npm run dev`
Click the "Desserts" category card on the dashboard — should navigate to `/categories/[uuid]` and show the category name with "No recipes in this category yet."

**Step 3: Commit**

```bash
git add src/app/categories/\\[id\\]/page.tsx
git commit -m "added category detail page"
```

---

### Task 6: Search Bar

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add search state and Supabase query to AppShell**

In `src/components/app-shell.tsx`:

1. Add import: `import { supabase } from "@/lib/supabase";`
2. Add search state inside the `AppShell` component:

```tsx
const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState<{ id: string; title: string }[]>([]);
const [searchOpen, setSearchOpen] = useState(false);

useEffect(() => {
  if (searchQuery.length < 2) {
    setSearchResults([]);
    setSearchOpen(false);
    return;
  }

  const timeout = setTimeout(async () => {
    const { data } = await supabase
      .from("recipes")
      .select("id, title")
      .ilike("title", `%${searchQuery}%`)
      .limit(8);

    if (data) {
      setSearchResults(data);
      setSearchOpen(true);
    }
  }, 300);

  return () => clearTimeout(timeout);
}, [searchQuery]);
```

3. Replace the `<input type="search" ...>` line with:

```tsx
<div className="search-wrapper">
  <input
    type="search"
    placeholder="Search recipes..."
    aria-label="Search recipes"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
    onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
  />
  {searchOpen && searchResults.length > 0 && (
    <div className="search-dropdown">
      {searchResults.map((r) => (
        <div key={r.id} className="search-result">
          {r.title}
        </div>
      ))}
    </div>
  )}
  {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && (
    <div className="search-dropdown">
      <div className="search-result search-no-results">No recipes found</div>
    </div>
  )}
</div>
```

**Step 2: Add search CSS**

In `src/app/globals.css`, add after the category card styles:

```css
/* ── Search dropdown ──────────────────────────────────── */

.search-wrapper {
  flex: 1;
  position: relative;
}

.search-wrapper input {
  width: 100%;
}

.search-dropdown {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  box-shadow: 0 8px 24px rgba(74, 55, 40, 0.12);
  left: 0;
  max-height: 280px;
  overflow-y: auto;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
}

.search-result {
  color: var(--color-text);
  font-size: 0.88rem;
  padding: 0.6rem 0.75rem;
  transition: background 0.1s;
}

.search-result:hover {
  background: #fef0f3;
}

.search-no-results {
  color: var(--color-secondary);
  font-style: italic;
}
```

**Step 3: Verify**

Run: `npm run dev`
Type in the search bar — with empty DB, typing anything 2+ chars should show "No recipes found" dropdown. The dropdown should dismiss on blur.

**Step 4: Commit**

```bash
git add src/components/app-shell.tsx src/app/globals.css
git commit -m "wired up search bar with supabase"
```

---

### Task 7: Revisit Letter Link on Dashboard

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/letter/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create standalone letter page**

Create `src/app/letter/page.tsx`:

```tsx
"use client";

import { BirthdayLoveLetter } from "@/components/birthday-love-letter";
import { useRouter } from "next/navigation";

export default function LetterPage() {
  const router = useRouter();

  return <BirthdayLoveLetter onComplete={() => router.push("/")} />;
}
```

**Step 2: Add letter link card to dashboard**

In `src/app/page.tsx`, add after the Categories section (at the bottom of the `<AppShell>` children):

```tsx
<section className="dashboard-section">
  <Link href="/letter" className="letter-card">
    <span className="letter-card-text">Read your letter</span>
  </Link>
</section>
```

**Step 3: Add letter card CSS**

In `src/app/globals.css`, add:

```css
/* ── Letter card ──────────────────────────────────────── */

.letter-card {
  align-items: center;
  background: linear-gradient(168deg, #fffaf3, #fff5eb);
  border: 1px solid #e2cdb8;
  border-radius: 0.25rem;
  display: flex;
  justify-content: center;
  padding: 1rem 1.5rem;
  text-decoration: none;
  transition: box-shadow 0.2s, transform 0.2s;
}

.letter-card:hover {
  box-shadow: 0 4px 16px rgba(74, 55, 40, 0.1);
  transform: translateY(-2px);
}

.letter-card-text {
  color: #5a4133;
  font-family: var(--font-dancing), cursive;
  font-size: 1.1rem;
}
```

**Step 4: Verify**

Run: `npm run dev`
Dashboard should show a "Read your letter" card at the bottom. Clicking it navigates to `/letter` which shows the love letter. The "Open Your Cookbook" button returns to the dashboard.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/letter/page.tsx src/app/globals.css
git commit -m "added revisit letter link on dashboard"
```

---

### Task 8: Recipes Page

**Files:**
- Modify: `src/app/recipes/page.tsx`

**Step 1: Replace placeholder with real recipe list**

Replace `src/app/recipes/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  category_name: string | null;
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, cover_image_url, recipe_categories(categories(name))")
        .order("created_at", { ascending: false });

      if (data) {
        setRecipes(
          data.map((r: any) => ({
            id: r.id,
            title: r.title,
            cover_image_url: r.cover_image_url,
            category_name: r.recipe_categories?.[0]?.categories?.name ?? null,
          }))
        );
      }
      setLoading(false);
    }
    fetchAll();
  }, []);

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">All Recipes</h1>
        {loading ? (
          <p className="empty-state-text">Loading...</p>
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No recipes yet — add your first one!</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <article key={recipe.id} className="recipe-card">
                <div className="recipe-info">
                  <span className="recipe-name">{recipe.title}</span>
                  {recipe.category_name && (
                    <span className="recipe-tag">{recipe.category_name}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
```

**Step 2: Verify**

Run: `npm run dev`
Navigate to /recipes — should show "No recipes yet — add your first one!" empty state.

**Step 3: Commit**

```bash
git add src/app/recipes/page.tsx
git commit -m "wired recipes page to supabase"
```

---

### Task 9: Favorites Page

**Files:**
- Modify: `src/app/favorites/page.tsx`

**Step 1: Replace placeholder with real favorites list**

Replace `src/app/favorites/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  category_name: string | null;
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFavs() {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, cover_image_url, recipe_categories(categories(name))")
        .eq("is_favorite", true)
        .order("created_at", { ascending: false });

      if (data) {
        setFavorites(
          data.map((r: any) => ({
            id: r.id,
            title: r.title,
            cover_image_url: r.cover_image_url,
            category_name: r.recipe_categories?.[0]?.categories?.name ?? null,
          }))
        );
      }
      setLoading(false);
    }
    fetchFavs();
  }, []);

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">Favorites</h1>
        {loading ? (
          <p className="empty-state-text">Loading...</p>
        ) : favorites.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Heart a recipe to see it here</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {favorites.map((recipe) => (
              <article key={recipe.id} className="recipe-card">
                <div className="recipe-info">
                  <span className="recipe-name">{recipe.title}</span>
                  {recipe.category_name && (
                    <span className="recipe-tag">{recipe.category_name}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
```

**Step 2: Verify**

Run: `npm run dev`
Navigate to /favorites — should show "Heart a recipe to see it here" empty state.

**Step 3: Commit**

```bash
git add src/app/favorites/page.tsx
git commit -m "wired favorites page to supabase"
```

---

### Task 10: Final build check

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Commit any remaining changes**

If there are lint/type fixes needed, fix and commit:

```bash
git add -A
git commit -m "phase 2 completion build fixes"
```
