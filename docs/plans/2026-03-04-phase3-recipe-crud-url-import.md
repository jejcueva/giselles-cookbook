# Phase 3: Recipe CRUD + URL Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable adding, viewing, editing, and deleting recipes — including importing from blog URLs via JSON-LD scraping. This is the core app functionality.

**Architecture:** Client-side React forms with direct Supabase queries for CRUD. One Next.js API route (`/api/scrape-recipe`) for server-side blog URL scraping. Cover photo uploads go to Supabase Storage bucket `recipe-photos`. All pages use the existing `<AppShell>` wrapper and CSS classes from `globals.css`. Assumes Phase 2 is complete (Supabase client at `src/lib/supabase.ts`, pages wired to DB).

**Tech Stack:** Next.js 16, React 19, Supabase JS v2, Tailwind CSS v4, existing vanilla CSS classes

**Supabase schema reference:** `supabase/migrations/20260224_phase1_mvp_tables.sql`
- `recipes` — main recipe data (title, ingredients jsonb, instructions jsonb, notes, source_url, cook_time, prep_time, servings, calories, protein, carbs, fat, is_favorite, cover_image_url)
- `categories` — id, name, emoji
- `recipe_categories` — junction (recipe_id, category_id)
- `recipe_tags` — id, recipe_id, tag
- `recipe_photos` — id, recipe_id, image_url, sort_order

---

### Task 1: Create the Add Recipe page shell with basic fields

**Files:**
- Create: `src/app/recipes/new/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/app-shell.tsx` (wire "+ New Recipe" button)

**Step 1: Create the recipe form page with basic fields**

Create `src/app/recipes/new/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewRecipePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [servings, setServings] = useState("");

  return (
    <AppShell>
      <div className="recipe-form-page">
        <h1 className="section-title">Add New Recipe</h1>

        <form className="recipe-form" onSubmit={(e) => e.preventDefault()}>
          <label className="form-label">
            Title *
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recipe name"
              required
            />
          </label>

          <div className="form-row-3">
            <label className="form-label">
              Prep Time (min)
              <input
                type="number"
                className="form-input"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                min="0"
              />
            </label>
            <label className="form-label">
              Cook Time (min)
              <input
                type="number"
                className="form-input"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                min="0"
              />
            </label>
            <label className="form-label">
              Servings
              <input
                type="number"
                className="form-input"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                min="1"
              />
            </label>
          </div>

          <label className="form-label">
            Notes
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Personal tips, substitutions, memories..."
              rows={3}
            />
          </label>

          <label className="form-label">
            Source URL
            <input
              type="url"
              className="form-input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>

          {/* Ingredients, instructions, macros, categories, tags, photo — added in subsequent tasks */}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => router.back()}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled>
              Save Recipe
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
```

**Step 2: Add recipe form CSS**

In `src/app/globals.css`, add at the end:

```css
/* ── Recipe form ─────────────────────────────────────── */

.recipe-form-page {
  max-width: 720px;
}

.recipe-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1rem;
}

.form-label {
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  font-size: 0.88rem;
  font-weight: 700;
  gap: 0.35rem;
}

.form-input,
.form-textarea,
.form-select {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.92rem;
  padding: 0.6rem 0.75rem;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  border-color: var(--color-primary);
  outline: none;
}

.form-textarea {
  resize: vertical;
}

.form-row-3 {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr 1fr 1fr;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.btn-primary {
  background: var(--color-primary);
  border: none;
  border-radius: 0.25rem;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.6rem 1.5rem;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  color: var(--color-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.6rem 1.5rem;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #fef0f3;
}
```

**Step 3: Wire the "+ New Recipe" button in AppShell**

In `src/components/app-shell.tsx`, change the topbar button from:
```tsx
<button type="button">+ New Recipe</button>
```
to:
```tsx
<Link href="/recipes/new" className="btn-primary">+ New Recipe</Link>
```

Make sure `Link` is imported from `next/link` (it already is).

**Step 4: Verify**

Run: `npm run dev`
Click "+ New Recipe" in the topbar — should navigate to `/recipes/new` and show the form with title, times, servings, notes, source URL fields. Cancel button goes back.

**Step 5: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css src/components/app-shell.tsx
git commit -m "added new recipe form page with basic fields"
```

---

### Task 2: Dynamic ingredients list

**Files:**
- Modify: `src/app/recipes/new/page.tsx`

**Step 1: Add ingredients state and UI**

In `src/app/recipes/new/page.tsx`, add ingredients state:

```tsx
type Ingredient = { name: string; amount: string; unit: string };

const [ingredients, setIngredients] = useState<Ingredient[]>([
  { name: "", amount: "", unit: "" },
]);

function addIngredient() {
  setIngredients([...ingredients, { name: "", amount: "", unit: "" }]);
}

function removeIngredient(index: number) {
  setIngredients(ingredients.filter((_, i) => i !== index));
}

function updateIngredient(index: number, field: keyof Ingredient, value: string) {
  const updated = [...ingredients];
  updated[index] = { ...updated[index], [field]: value };
  setIngredients(updated);
}
```

Add JSX after the source URL field:

```tsx
<fieldset className="form-fieldset">
  <legend className="form-legend">Ingredients</legend>
  {ingredients.map((ing, i) => (
    <div key={i} className="ingredient-row">
      <input
        type="text"
        className="form-input"
        placeholder="Amount"
        value={ing.amount}
        onChange={(e) => updateIngredient(i, "amount", e.target.value)}
        style={{ flex: "0 0 80px" }}
      />
      <input
        type="text"
        className="form-input"
        placeholder="Unit"
        value={ing.unit}
        onChange={(e) => updateIngredient(i, "unit", e.target.value)}
        style={{ flex: "0 0 80px" }}
      />
      <input
        type="text"
        className="form-input"
        placeholder="Ingredient name"
        value={ing.name}
        onChange={(e) => updateIngredient(i, "name", e.target.value)}
        style={{ flex: 1 }}
      />
      {ingredients.length > 1 && (
        <button type="button" className="btn-icon-remove" onClick={() => removeIngredient(i)}>
          ×
        </button>
      )}
    </div>
  ))}
  <button type="button" className="btn-add-row" onClick={addIngredient}>
    + Add Ingredient
  </button>
</fieldset>
```

**Step 2: Add CSS for dynamic list rows**

In `src/app/globals.css`, add after the `.btn-secondary:hover` block:

```css
/* ── Dynamic list rows ───────────────────────────────── */

.form-fieldset {
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
}

.form-legend {
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0 0.25rem;
}

.ingredient-row,
.instruction-row {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.btn-icon-remove {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-secondary);
  cursor: pointer;
  font-size: 1.1rem;
  height: 28px;
  line-height: 1;
  width: 28px;
}

.btn-icon-remove:hover {
  background: #fde8e8;
  border-color: #e8a0a0;
  color: #c44;
}

.btn-add-row {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.3rem 0;
}

.btn-add-row:hover {
  text-decoration: underline;
}
```

**Step 3: Verify**

Run: `npm run dev`
Go to `/recipes/new` — ingredients section shows one row with amount, unit, name. Clicking "+ Add Ingredient" adds another row. "×" removes a row (can't remove last one).

**Step 4: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css
git commit -m "added dynamic ingredients list to recipe form"
```

---

### Task 3: Dynamic instructions list

**Files:**
- Modify: `src/app/recipes/new/page.tsx`

**Step 1: Add instructions state and UI**

In `src/app/recipes/new/page.tsx`, add:

```tsx
const [instructions, setInstructions] = useState<string[]>([""]);

function addInstruction() {
  setInstructions([...instructions, ""]);
}

function removeInstruction(index: number) {
  setInstructions(instructions.filter((_, i) => i !== index));
}

function updateInstruction(index: number, value: string) {
  const updated = [...instructions];
  updated[index] = value;
  setInstructions(updated);
}
```

Add JSX after the ingredients fieldset:

```tsx
<fieldset className="form-fieldset">
  <legend className="form-legend">Instructions</legend>
  {instructions.map((step, i) => (
    <div key={i} className="instruction-row">
      <span className="step-number">{i + 1}.</span>
      <textarea
        className="form-textarea"
        placeholder={`Step ${i + 1}`}
        value={step}
        onChange={(e) => updateInstruction(i, e.target.value)}
        rows={2}
        style={{ flex: 1 }}
      />
      {instructions.length > 1 && (
        <button type="button" className="btn-icon-remove" onClick={() => removeInstruction(i)}>
          ×
        </button>
      )}
    </div>
  ))}
  <button type="button" className="btn-add-row" onClick={addInstruction}>
    + Add Step
  </button>
</fieldset>
```

**Step 2: Add step number CSS**

In `src/app/globals.css`, add after `.btn-add-row:hover`:

```css
.step-number {
  color: var(--color-secondary);
  font-size: 0.88rem;
  font-weight: 700;
  min-width: 24px;
}
```

**Step 3: Verify**

Run: `npm run dev`
Go to `/recipes/new` — instructions section shows step 1 textarea. Adding steps increments the number. Remove works.

**Step 4: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css
git commit -m "added dynamic instructions list to recipe form"
```

---

### Task 4: Nutrition / macros input section

**Files:**
- Modify: `src/app/recipes/new/page.tsx`

**Step 1: Add macros state and UI**

In `src/app/recipes/new/page.tsx`, add state:

```tsx
const [calories, setCalories] = useState("");
const [protein, setProtein] = useState("");
const [carbs, setCarbs] = useState("");
const [fat, setFat] = useState("");
```

Add JSX after the instructions fieldset:

```tsx
<fieldset className="form-fieldset">
  <legend className="form-legend">Nutrition (per serving)</legend>
  <div className="macros-grid">
    <label className="form-label">
      Calories
      <input type="number" className="form-input" value={calories} onChange={(e) => setCalories(e.target.value)} min="0" />
    </label>
    <label className="form-label">
      Protein (g)
      <input type="number" className="form-input" value={protein} onChange={(e) => setProtein(e.target.value)} min="0" step="0.1" />
    </label>
    <label className="form-label">
      Carbs (g)
      <input type="number" className="form-input" value={carbs} onChange={(e) => setCarbs(e.target.value)} min="0" step="0.1" />
    </label>
    <label className="form-label">
      Fat (g)
      <input type="number" className="form-input" value={fat} onChange={(e) => setFat(e.target.value)} min="0" step="0.1" />
    </label>
  </div>
</fieldset>
```

**Step 2: Add macros grid CSS**

In `src/app/globals.css`, add:

```css
.macros-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 600px) {
  .macros-grid {
    grid-template-columns: 1fr 1fr;
  }
}
```

**Step 3: Verify**

Run: `npm run dev`
Nutrition section shows 4 inputs in a row (2×2 on mobile). All accept numbers.

**Step 4: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css
git commit -m "added nutrition macros input to recipe form"
```

---

### Task 5: Category selector with create-new inline

**Files:**
- Modify: `src/app/recipes/new/page.tsx`

**Step 1: Add category state, fetch, and inline create**

In `src/app/recipes/new/page.tsx`, add imports:

```tsx
import { supabase } from "@/lib/supabase";
import { useEffect } from "react"; // add useEffect to existing import
```

Add state and fetch:

```tsx
type Category = { id: string; name: string; emoji: string | null };

const [categories, setCategories] = useState<Category[]>([]);
const [selectedCategoryId, setSelectedCategoryId] = useState("");
const [showNewCategory, setShowNewCategory] = useState(false);
const [newCategoryName, setNewCategoryName] = useState("");
const [newCategoryEmoji, setNewCategoryEmoji] = useState("");

useEffect(() => {
  async function fetchCategories() {
    const { data } = await supabase.from("categories").select("id, name, emoji").order("name");
    if (data) setCategories(data);
  }
  fetchCategories();
}, []);

async function createCategory() {
  if (!newCategoryName.trim()) return;
  const { data } = await supabase
    .from("categories")
    .insert({ name: newCategoryName.trim(), emoji: newCategoryEmoji.trim() || null })
    .select("id, name, emoji")
    .single();
  if (data) {
    setCategories([...categories, data]);
    setSelectedCategoryId(data.id);
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryEmoji("");
  }
}
```

Add JSX after the macros fieldset:

```tsx
<div className="form-label">
  Category
  <div className="category-select-row">
    <select
      className="form-select"
      value={selectedCategoryId}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setShowNewCategory(true);
          setSelectedCategoryId("");
        } else {
          setSelectedCategoryId(e.target.value);
          setShowNewCategory(false);
        }
      }}
    >
      <option value="">None</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.emoji ? `${cat.emoji} ` : ""}{cat.name}
        </option>
      ))}
      <option value="__new__">+ New Category</option>
    </select>
  </div>
  {showNewCategory && (
    <div className="new-category-row">
      <input
        type="text"
        className="form-input"
        placeholder="Emoji"
        value={newCategoryEmoji}
        onChange={(e) => setNewCategoryEmoji(e.target.value)}
        style={{ flex: "0 0 64px" }}
      />
      <input
        type="text"
        className="form-input"
        placeholder="Category name"
        value={newCategoryName}
        onChange={(e) => setNewCategoryName(e.target.value)}
        style={{ flex: 1 }}
      />
      <button type="button" className="btn-primary" onClick={createCategory} style={{ padding: "0.5rem 1rem" }}>
        Add
      </button>
    </div>
  )}
</div>
```

**Step 2: Add category select CSS**

In `src/app/globals.css`, add:

```css
.category-select-row {
  display: flex;
  gap: 0.5rem;
}

.category-select-row select {
  flex: 1;
}

.new-category-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
```

**Step 3: Verify**

Run: `npm run dev`
Category dropdown shows "None", existing categories, and "+ New Category". Selecting "+ New Category" reveals inline inputs. Creating a category adds it to the dropdown and selects it.

**Step 4: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css
git commit -m "added category selector with inline create to recipe form"
```

---

### Task 6: Free-form tag input

**Files:**
- Modify: `src/app/recipes/new/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add tag state and UI**

In `src/app/recipes/new/page.tsx`, add:

```tsx
const [tags, setTags] = useState<string[]>([]);
const [tagInput, setTagInput] = useState("");

function addTag() {
  const trimmed = tagInput.trim().toLowerCase();
  if (trimmed && !tags.includes(trimmed)) {
    setTags([...tags, trimmed]);
  }
  setTagInput("");
}

function removeTag(tag: string) {
  setTags(tags.filter((t) => t !== tag));
}
```

Add JSX after the category section:

```tsx
<div className="form-label">
  Tags
  <div className="tag-input-row">
    <input
      type="text"
      className="form-input"
      placeholder="Add a tag and press Enter"
      value={tagInput}
      onChange={(e) => setTagInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addTag();
        }
      }}
      style={{ flex: 1 }}
    />
    <button type="button" className="btn-secondary" onClick={addTag} style={{ padding: "0.5rem 1rem" }}>
      Add
    </button>
  </div>
  {tags.length > 0 && (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          <button type="button" className="tag-remove" onClick={() => removeTag(tag)}>×</button>
        </span>
      ))}
    </div>
  )}
</div>
```

**Step 2: Add tag CSS**

In `src/app/globals.css`, add:

```css
/* ── Tags ────────────────────────────────────────────── */

.tag-input-row {
  display: flex;
  gap: 0.5rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.4rem;
}

.tag-chip {
  align-items: center;
  background: #fef0f3;
  border: 1px solid var(--color-primary);
  border-radius: 1rem;
  color: var(--color-text);
  display: inline-flex;
  font-size: 0.8rem;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
}

.tag-remove {
  background: none;
  border: none;
  color: var(--color-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
}

.tag-remove:hover {
  color: #c44;
}
```

**Step 3: Verify**

Run: `npm run dev`
Type a tag and press Enter or click Add — chip appears. Click × to remove. Duplicates are prevented.

**Step 4: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css
git commit -m "added tag input to recipe form"
```

---

### Task 7: Cover photo upload to Supabase Storage

**Files:**
- Modify: `src/app/recipes/new/page.tsx`
- Modify: `src/app/globals.css`

**Prerequisites:** A Supabase Storage bucket named `recipe-photos` must exist. If not, create it via the Supabase dashboard (public bucket) or run:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-photos', 'recipe-photos', true);
```

**Step 1: Add photo upload state and handler**

In `src/app/recipes/new/page.tsx`, add:

```tsx
const [coverFile, setCoverFile] = useState<File | null>(null);
const [coverPreview, setCoverPreview] = useState<string | null>(null);

function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setCoverFile(file);
  setCoverPreview(URL.createObjectURL(file));
}
```

Add JSX after the title field (so the photo is near the top):

```tsx
<div className="form-label">
  Cover Photo
  <div className="photo-upload-area">
    {coverPreview ? (
      <div className="photo-preview-wrap">
        <img src={coverPreview} alt="Cover preview" className="photo-preview" />
        <button
          type="button"
          className="btn-icon-remove photo-remove"
          onClick={() => { setCoverFile(null); setCoverPreview(null); }}
        >
          ×
        </button>
      </div>
    ) : (
      <label className="photo-drop-label">
        <span>Click to upload a photo</span>
        <input type="file" accept="image/*" onChange={handleCoverSelect} hidden />
      </label>
    )}
  </div>
</div>
```

**Step 2: Add photo upload CSS**

In `src/app/globals.css`, add:

```css
/* ── Photo upload ────────────────────────────────────── */

.photo-upload-area {
  border: 2px dashed var(--color-border);
  border-radius: 0.25rem;
  overflow: hidden;
}

.photo-drop-label {
  align-items: center;
  cursor: pointer;
  display: flex;
  justify-content: center;
  min-height: 160px;
  padding: 1.5rem;
}

.photo-drop-label span {
  color: var(--color-secondary);
  font-size: 0.88rem;
  font-weight: 600;
}

.photo-preview-wrap {
  position: relative;
}

.photo-preview {
  display: block;
  max-height: 280px;
  object-fit: cover;
  width: 100%;
}

.photo-remove {
  position: absolute;
  right: 8px;
  top: 8px;
}
```

**Step 3: Verify**

Run: `npm run dev`
Photo upload area shows "Click to upload a photo". Selecting a file shows a preview. × button clears it.

**Step 4: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css
git commit -m "added cover photo upload to recipe form"
```

---

### Task 8: Wire form submission — save recipe to Supabase

**Files:**
- Modify: `src/app/recipes/new/page.tsx`

**Step 1: Add saving state and submit handler**

In `src/app/recipes/new/page.tsx`, add:

```tsx
const [saving, setSaving] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!title.trim()) return;
  setSaving(true);

  try {
    // Upload cover photo if present
    let coverImageUrl: string | null = null;
    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `covers/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-photos")
        .upload(path, coverFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("recipe-photos").getPublicUrl(path);
        coverImageUrl = urlData.publicUrl;
      }
    }

    // Insert recipe
    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({
        title: title.trim(),
        ingredients: ingredients.filter((ing) => ing.name.trim()),
        instructions: instructions
          .filter((s) => s.trim())
          .map((text, i) => ({ step_number: i + 1, text })),
        notes: notes.trim() || null,
        source_url: sourceUrl.trim() || null,
        cook_time: cookTime ? parseInt(cookTime) : null,
        prep_time: prepTime ? parseInt(prepTime) : null,
        servings: servings ? parseInt(servings) : null,
        calories: calories ? parseInt(calories) : null,
        protein: protein ? parseFloat(protein) : null,
        carbs: carbs ? parseFloat(carbs) : null,
        fat: fat ? parseFloat(fat) : null,
        cover_image_url: coverImageUrl,
      })
      .select("id")
      .single();

    if (error || !recipe) {
      alert("Failed to save recipe");
      setSaving(false);
      return;
    }

    // Insert category link
    if (selectedCategoryId) {
      await supabase.from("recipe_categories").insert({
        recipe_id: recipe.id,
        category_id: selectedCategoryId,
      });
    }

    // Insert tags
    if (tags.length > 0) {
      await supabase.from("recipe_tags").insert(
        tags.map((tag) => ({ recipe_id: recipe.id, tag }))
      );
    }

    router.push(`/recipes/${recipe.id}`);
  } catch {
    alert("Something went wrong");
    setSaving(false);
  }
}
```

**Step 2: Wire the form's onSubmit and enable the save button**

Change the `<form>` tag:
```tsx
<form className="recipe-form" onSubmit={handleSubmit}>
```

Change the submit button:
```tsx
<button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
  {saving ? "Saving..." : "Save Recipe"}
</button>
```

**Step 3: Verify**

Run: `npm run dev`
Fill in a recipe title and click "Save Recipe". Should insert into Supabase and redirect to `/recipes/[id]` (which will 404 for now — that's Task 11).

**Step 4: Commit**

```bash
git add src/app/recipes/new/page.tsx
git commit -m "wired recipe form submission to supabase"
```

---

### Task 9: Blog URL import — API route

**Files:**
- Create: `src/app/api/scrape-recipe/route.ts`

**Step 1: Create the scraping API route**

Create `src/app/api/scrape-recipe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

type ScrapedRecipe = {
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
  imageUrl: string | null;
};

function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  return hours * 60 + minutes || null;
}

function parseNutritionValue(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseIngredient(raw: string): { name: string; amount: string; unit: string } {
  // Simple parse: first token as amount, second as unit, rest as name
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 3 && /^\d/.test(parts[0])) {
    return { amount: parts[0], unit: parts[1], name: parts.slice(2).join(" ") };
  }
  if (parts.length >= 2 && /^\d/.test(parts[0])) {
    return { amount: parts[0], unit: "", name: parts.slice(1).join(" ") };
  }
  return { amount: "", unit: "", name: raw.trim() };
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CuteCookbook/1.0)" },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 });
    }

    const html = await response.text();

    // Extract JSON-LD blocks
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let recipe: any = null;
    let match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        // Could be an array or single object
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        for (const candidate of candidates) {
          if (
            candidate["@type"] === "Recipe" ||
            (Array.isArray(candidate["@type"]) && candidate["@type"].includes("Recipe"))
          ) {
            recipe = candidate;
            break;
          }
          // Check @graph array
          if (candidate["@graph"]) {
            for (const node of candidate["@graph"]) {
              if (
                node["@type"] === "Recipe" ||
                (Array.isArray(node["@type"]) && node["@type"].includes("Recipe"))
              ) {
                recipe = node;
                break;
              }
            }
          }
        }
        if (recipe) break;
      } catch {
        // skip malformed JSON-LD
      }
    }

    if (!recipe) {
      return NextResponse.json(
        { error: "No recipe data found on this page. Try adding the recipe manually." },
        { status: 404 }
      );
    }

    const nutrition = recipe.nutrition || {};

    const scraped: ScrapedRecipe = {
      title: recipe.name || "",
      ingredients: (recipe.recipeIngredient || []).map((s: string) => parseIngredient(s)),
      instructions: (recipe.recipeInstructions || []).map((step: any) =>
        typeof step === "string" ? step : step.text || ""
      ),
      cookTime: parseDuration(recipe.cookTime),
      prepTime: parseDuration(recipe.prepTime),
      servings: recipe.recipeYield
        ? parseInt(String(Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield)) || null
        : null,
      calories: parseNutritionValue(nutrition.calories),
      protein: parseNutritionValue(nutrition.proteinContent),
      carbs: parseNutritionValue(nutrition.carbohydrateContent),
      fat: parseNutritionValue(nutrition.fatContent),
      imageUrl: Array.isArray(recipe.image)
        ? recipe.image[0]
        : typeof recipe.image === "string"
          ? recipe.image
          : recipe.image?.url || null,
    };

    return NextResponse.json(scraped);
  } catch {
    return NextResponse.json({ error: "Failed to process URL" }, { status: 500 });
  }
}
```

**Step 2: Verify**

Run: `npm run dev`

Test with curl:
```bash
curl -X POST http://localhost:3000/api/scrape-recipe \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"}'
```

Expected: JSON response with title, ingredients, instructions etc. If the specific URL doesn't have JSON-LD, try another recipe blog URL.

**Step 3: Commit**

```bash
git add src/app/api/scrape-recipe/route.ts
git commit -m "added blog url scraper api route for json-ld recipes"
```

---

### Task 10: Import from URL — form UI and auto-fill

**Files:**
- Modify: `src/app/recipes/new/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add import URL section at top of form**

In `src/app/recipes/new/page.tsx`, add state:

```tsx
const [importUrl, setImportUrl] = useState("");
const [importing, setImporting] = useState(false);
const [importError, setImportError] = useState("");
```

Add the import handler:

```tsx
async function handleImport() {
  if (!importUrl.trim()) return;
  setImporting(true);
  setImportError("");

  try {
    const res = await fetch("/api/scrape-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: importUrl.trim() }),
    });

    const data = await res.json();

    if (!res.ok) {
      setImportError(data.error || "Failed to import");
      setImporting(false);
      return;
    }

    // Auto-fill form fields
    if (data.title) setTitle(data.title);
    if (data.ingredients?.length) setIngredients(data.ingredients);
    if (data.instructions?.length) setInstructions(data.instructions);
    if (data.cookTime) setCookTime(String(data.cookTime));
    if (data.prepTime) setPrepTime(String(data.prepTime));
    if (data.servings) setServings(String(data.servings));
    if (data.calories) setCalories(String(data.calories));
    if (data.protein) setProtein(String(data.protein));
    if (data.carbs) setCarbs(String(data.carbs));
    if (data.fat) setFat(String(data.fat));
    setSourceUrl(importUrl.trim());

    // If the scraped recipe has an image URL, set it as a preview
    if (data.imageUrl) {
      setCoverPreview(data.imageUrl);
      // Note: this is an external URL preview. The actual upload happens on save.
      // We'll store the external URL directly as cover_image_url if no file is uploaded.
    }
  } catch {
    setImportError("Something went wrong");
  }
  setImporting(false);
}
```

Add JSX at the very top of the form (before the title field):

```tsx
<div className="import-section">
  <label className="form-label">
    Import from URL
    <div className="import-row">
      <input
        type="url"
        className="form-input"
        placeholder="Paste a recipe blog URL..."
        value={importUrl}
        onChange={(e) => setImportUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleImport();
          }
        }}
        style={{ flex: 1 }}
      />
      <button
        type="button"
        className="btn-primary"
        onClick={handleImport}
        disabled={importing || !importUrl.trim()}
        style={{ padding: "0.6rem 1.2rem" }}
      >
        {importing ? "Importing..." : "Import"}
      </button>
    </div>
    {importError && <p className="import-error">{importError}</p>}
  </label>
  <div className="import-divider">
    <span>or fill in manually</span>
  </div>
</div>
```

**Step 2: Update the submit handler for external image URLs**

In the `handleSubmit` function, after the cover photo upload block, add a fallback for external preview URLs:

```tsx
// If no file was uploaded but we have an external preview URL (from import), use it directly
if (!coverImageUrl && coverPreview && !coverFile) {
  coverImageUrl = coverPreview;
}
```

**Step 3: Add import section CSS**

In `src/app/globals.css`, add:

```css
/* ── Import section ──────────────────────────────────── */

.import-section {
  margin-bottom: 0.5rem;
}

.import-row {
  display: flex;
  gap: 0.5rem;
}

.import-error {
  color: #c44;
  font-size: 0.82rem;
  margin-top: 0.3rem;
}

.import-divider {
  align-items: center;
  display: flex;
  gap: 1rem;
  margin-top: 1.25rem;
}

.import-divider::before,
.import-divider::after {
  background: var(--color-border);
  content: "";
  flex: 1;
  height: 1px;
}

.import-divider span {
  color: var(--color-secondary);
  font-size: 0.82rem;
  white-space: nowrap;
}
```

**Step 4: Verify**

Run: `npm run dev`
Go to `/recipes/new`. Paste a recipe blog URL and click Import. The form fields should auto-fill with the scraped data. If the URL has no JSON-LD, an error message appears.

**Step 5: Commit**

```bash
git add src/app/recipes/new/page.tsx src/app/globals.css
git commit -m "added blog url import with auto-fill on recipe form"
```

---

### Task 11: Recipe detail view page

**Files:**
- Create: `src/app/recipes/[id]/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create recipe detail page**

Create `src/app/recipes/[id]/page.tsx`:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Recipe = {
  id: string;
  title: string;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: { step_number: number; text: string }[];
  notes: string | null;
  source_url: string | null;
  cook_time: number | null;
  prep_time: number | null;
  servings: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  is_favorite: boolean;
  cover_image_url: string | null;
  created_at: string;
};

type Tag = { tag: string };
type CategoryJoin = { categories: { id: string; name: string; emoji: string | null } };

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; emoji: string | null }[]>([]);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecipe() {
      const [recipeResult, tagsResult, catsResult] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", recipeId).single(),
        supabase.from("recipe_tags").select("tag").eq("recipe_id", recipeId),
        supabase.from("recipe_categories").select("categories(id, name, emoji)").eq("recipe_id", recipeId),
      ]);

      if (recipeResult.data) setRecipe(recipeResult.data);
      if (tagsResult.data) setTags(tagsResult.data.map((t: Tag) => t.tag));
      if (catsResult.data) {
        setCategories(
          (catsResult.data as unknown as CategoryJoin[])
            .map((rc) => rc.categories)
            .filter(Boolean)
        );
      }
      setLoading(false);
    }
    fetchRecipe();
  }, [recipeId]);

  function toggleIngredient(index: number) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function toggleFavorite() {
    if (!recipe) return;
    const newVal = !recipe.is_favorite;
    await supabase.from("recipes").update({ is_favorite: newVal }).eq("id", recipe.id);
    setRecipe({ ...recipe, is_favorite: newVal });
  }

  if (loading) {
    return <AppShell><p className="empty-state-text">Loading...</p></AppShell>;
  }

  if (!recipe) {
    return <AppShell><p className="empty-state-text">Recipe not found.</p></AppShell>;
  }

  const hasMacros = recipe.calories || recipe.protein || recipe.carbs || recipe.fat;

  return (
    <AppShell>
      <div className="recipe-detail">
        {recipe.cover_image_url && (
          <img src={recipe.cover_image_url} alt={recipe.title} className="recipe-detail-hero" />
        )}

        <div className="recipe-detail-header">
          <h1 className="recipe-detail-title">{recipe.title}</h1>
          <button
            type="button"
            className={`favorite-btn ${recipe.is_favorite ? "favorited" : ""}`}
            onClick={toggleFavorite}
            aria-label={recipe.is_favorite ? "Remove from favorites" : "Add to favorites"}
          >
            {recipe.is_favorite ? "♥" : "♡"}
          </button>
        </div>

        <div className="recipe-detail-meta">
          {recipe.prep_time && <span className="meta-chip">Prep: {recipe.prep_time}m</span>}
          {recipe.cook_time && <span className="meta-chip">Cook: {recipe.cook_time}m</span>}
          {recipe.servings && <span className="meta-chip">Serves {recipe.servings}</span>}
        </div>

        {categories.length > 0 && (
          <div className="recipe-detail-cats">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.id}`} className="tag-chip">
                {cat.emoji ? `${cat.emoji} ` : ""}{cat.name}
              </Link>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="recipe-detail-tags">
            {tags.map((tag) => (
              <span key={tag} className="tag-chip">{tag}</span>
            ))}
          </div>
        )}

        {hasMacros && (
          <div className="nutrition-card">
            <h3 className="nutrition-title">Nutrition (per serving)</h3>
            <div className="nutrition-grid">
              {recipe.calories != null && (
                <div className="nutrition-item">
                  <span className="nutrition-value">{recipe.calories}</span>
                  <span className="nutrition-label">cal</span>
                </div>
              )}
              {recipe.protein != null && (
                <div className="nutrition-item">
                  <span className="nutrition-value">{recipe.protein}g</span>
                  <span className="nutrition-label">protein</span>
                </div>
              )}
              {recipe.carbs != null && (
                <div className="nutrition-item">
                  <span className="nutrition-value">{recipe.carbs}g</span>
                  <span className="nutrition-label">carbs</span>
                </div>
              )}
              {recipe.fat != null && (
                <div className="nutrition-item">
                  <span className="nutrition-value">{recipe.fat}g</span>
                  <span className="nutrition-label">fat</span>
                </div>
              )}
            </div>
          </div>
        )}

        {recipe.ingredients?.length > 0 && (
          <section className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Ingredients</h2>
            <ul className="ingredient-checklist">
              {recipe.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className={`ingredient-check-item ${checkedIngredients.has(i) ? "checked" : ""}`}
                  onClick={() => toggleIngredient(i)}
                >
                  <input
                    type="checkbox"
                    checked={checkedIngredients.has(i)}
                    onChange={() => toggleIngredient(i)}
                    className="ingredient-checkbox"
                  />
                  <span>
                    {ing.amount && `${ing.amount} `}
                    {ing.unit && `${ing.unit} `}
                    {ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recipe.instructions?.length > 0 && (
          <section className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Instructions</h2>
            <ol className="instruction-list">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="instruction-step">
                  {step.text}
                </li>
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

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="source-link">
            View original recipe
          </a>
        )}

        <div className="recipe-detail-actions">
          <Link href={`/recipes/${recipe.id}/edit`} className="btn-primary">Edit</Link>
        </div>
      </div>
    </AppShell>
  );
}
```

**Step 2: Add recipe detail CSS**

In `src/app/globals.css`, add:

```css
/* ── Recipe detail ───────────────────────────────────── */

.recipe-detail {
  max-width: 720px;
}

.recipe-detail-hero {
  border-radius: 0.25rem;
  display: block;
  max-height: 360px;
  object-fit: cover;
  width: 100%;
}

.recipe-detail-header {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  margin-top: 1rem;
}

.recipe-detail-title {
  color: var(--color-text);
  font-family: var(--font-playfair), serif;
  font-size: 1.8rem;
}

.favorite-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 1.8rem;
  line-height: 1;
  transition: transform 0.2s;
}

.favorite-btn:hover {
  transform: scale(1.15);
}

.favorite-btn.favorited {
  color: #e8457c;
}

.recipe-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.meta-chip {
  background: #fef0f3;
  border-radius: 1rem;
  color: var(--color-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.25rem 0.7rem;
}

.recipe-detail-cats,
.recipe-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

/* ── Nutrition card ──────────────────────────────────── */

.nutrition-card {
  background: linear-gradient(168deg, #fef8f0, #fff5eb);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  margin-top: 1rem;
  padding: 1rem;
}

.nutrition-title {
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.nutrition-grid {
  display: flex;
  gap: 1.5rem;
}

.nutrition-item {
  align-items: center;
  display: flex;
  flex-direction: column;
}

.nutrition-value {
  color: var(--color-text);
  font-size: 1.2rem;
  font-weight: 700;
}

.nutrition-label {
  color: var(--color-secondary);
  font-size: 0.75rem;
}

/* ── Ingredient checklist ────────────────────────────── */

.recipe-detail-section {
  margin-top: 1.5rem;
}

.recipe-detail-section-title {
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  padding-bottom: 0.4rem;
}

.ingredient-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  list-style: none;
  padding: 0;
}

.ingredient-check-item {
  align-items: center;
  cursor: pointer;
  display: flex;
  font-size: 0.92rem;
  gap: 0.5rem;
  padding: 0.3rem 0;
}

.ingredient-check-item.checked span {
  color: var(--color-secondary);
  text-decoration: line-through;
}

.ingredient-checkbox {
  accent-color: var(--color-primary);
}

.instruction-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-left: 1.25rem;
}

.instruction-step {
  color: var(--color-text);
  font-size: 0.92rem;
  line-height: 1.6;
}

.recipe-notes-text {
  color: var(--color-text);
  font-size: 0.92rem;
  line-height: 1.6;
  white-space: pre-wrap;
}

.source-link {
  color: var(--color-primary);
  display: inline-block;
  font-size: 0.88rem;
  margin-top: 1rem;
}

.recipe-detail-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
```

**Step 3: Verify**

Run: `npm run dev`
Add a recipe via the form (Task 8). After redirect, the detail page should display the recipe with all sections: hero image, title, favorite toggle, meta chips, nutrition card, ingredient checkboxes, instructions, notes, and edit link.

**Step 4: Commit**

```bash
git add src/app/recipes/\\[id\\]/page.tsx src/app/globals.css
git commit -m "added recipe detail page with nutrition card and ingredient checkboxes"
```

---

### Task 12: Recipe edit page

**Files:**
- Create: `src/app/recipes/[id]/edit/page.tsx`

**Step 1: Create the edit page**

Create `src/app/recipes/[id]/edit/page.tsx`. This is very similar to the new recipe page, but pre-fills from existing data:

```tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

type Ingredient = { name: string; amount: string; unit: string };
type Category = { id: string; name: string; emoji: string | null };

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [servings, setServings] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", amount: "", unit: "" }]);
  const [instructions, setInstructions] = useState<string[]>([""]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [recipeResult, tagsResult, catsResult, allCats] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", recipeId).single(),
        supabase.from("recipe_tags").select("tag").eq("recipe_id", recipeId),
        supabase.from("recipe_categories").select("category_id").eq("recipe_id", recipeId),
        supabase.from("categories").select("id, name, emoji").order("name"),
      ]);

      if (recipeResult.data) {
        const r = recipeResult.data;
        setTitle(r.title || "");
        setNotes(r.notes || "");
        setSourceUrl(r.source_url || "");
        setCookTime(r.cook_time ? String(r.cook_time) : "");
        setPrepTime(r.prep_time ? String(r.prep_time) : "");
        setServings(r.servings ? String(r.servings) : "");
        setCalories(r.calories ? String(r.calories) : "");
        setProtein(r.protein ? String(r.protein) : "");
        setCarbs(r.carbs ? String(r.carbs) : "");
        setFat(r.fat ? String(r.fat) : "");
        if (r.ingredients?.length) setIngredients(r.ingredients);
        if (r.instructions?.length) setInstructions(r.instructions.map((s: any) => s.text));
        if (r.cover_image_url) setCoverPreview(r.cover_image_url);
      }

      if (tagsResult.data) setTags(tagsResult.data.map((t: any) => t.tag));
      if (catsResult.data?.[0]) setSelectedCategoryId(catsResult.data[0].category_id);
      if (allCats.data) setCategories(allCats.data);

      setLoading(false);
    }
    fetchData();
  }, [recipeId]);

  // Reuse all the same helper functions from new recipe page:
  function addIngredient() { setIngredients([...ingredients, { name: "", amount: "", unit: "" }]); }
  function removeIngredient(i: number) { setIngredients(ingredients.filter((_, idx) => idx !== i)); }
  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    const u = [...ingredients]; u[i] = { ...u[i], [field]: value }; setIngredients(u);
  }
  function addInstruction() { setInstructions([...instructions, ""]); }
  function removeInstruction(i: number) { setInstructions(instructions.filter((_, idx) => idx !== i)); }
  function updateInstruction(i: number, value: string) {
    const u = [...instructions]; u[i] = value; setInstructions(u);
  }
  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }
  function removeTag(tag: string) { setTags(tags.filter((t) => t !== tag)); }
  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    try {
      let coverImageUrl: string | null = coverPreview;

      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `covers/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("recipe-photos").upload(path, coverFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("recipe-photos").getPublicUrl(path);
          coverImageUrl = urlData.publicUrl;
        }
      }

      await supabase
        .from("recipes")
        .update({
          title: title.trim(),
          ingredients: ingredients.filter((ing) => ing.name.trim()),
          instructions: instructions.filter((s) => s.trim()).map((text, i) => ({ step_number: i + 1, text })),
          notes: notes.trim() || null,
          source_url: sourceUrl.trim() || null,
          cook_time: cookTime ? parseInt(cookTime) : null,
          prep_time: prepTime ? parseInt(prepTime) : null,
          servings: servings ? parseInt(servings) : null,
          calories: calories ? parseInt(calories) : null,
          protein: protein ? parseFloat(protein) : null,
          carbs: carbs ? parseFloat(carbs) : null,
          fat: fat ? parseFloat(fat) : null,
          cover_image_url: coverImageUrl,
        })
        .eq("id", recipeId);

      // Replace category link
      await supabase.from("recipe_categories").delete().eq("recipe_id", recipeId);
      if (selectedCategoryId) {
        await supabase.from("recipe_categories").insert({ recipe_id: recipeId, category_id: selectedCategoryId });
      }

      // Replace tags
      await supabase.from("recipe_tags").delete().eq("recipe_id", recipeId);
      if (tags.length > 0) {
        await supabase.from("recipe_tags").insert(tags.map((tag) => ({ recipe_id: recipeId, tag })));
      }

      router.push(`/recipes/${recipeId}`);
    } catch {
      alert("Something went wrong");
      setSaving(false);
    }
  }

  if (loading) {
    return <AppShell><p className="empty-state-text">Loading...</p></AppShell>;
  }

  // The JSX is identical to the new recipe form, minus the import section.
  // Render the same form fields: title, photo, prep/cook/servings, ingredients, instructions, macros, category, tags, notes, source URL.
  return (
    <AppShell>
      <div className="recipe-form-page">
        <h1 className="section-title">Edit Recipe</h1>
        <form className="recipe-form" onSubmit={handleSubmit}>
          <label className="form-label">
            Title *
            <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <div className="form-label">
            Cover Photo
            <div className="photo-upload-area">
              {coverPreview ? (
                <div className="photo-preview-wrap">
                  <img src={coverPreview} alt="Cover preview" className="photo-preview" />
                  <button type="button" className="btn-icon-remove photo-remove" onClick={() => { setCoverFile(null); setCoverPreview(null); }}>×</button>
                </div>
              ) : (
                <label className="photo-drop-label">
                  <span>Click to upload a photo</span>
                  <input type="file" accept="image/*" onChange={handleCoverSelect} hidden />
                </label>
              )}
            </div>
          </div>

          <div className="form-row-3">
            <label className="form-label">Prep Time (min)<input type="number" className="form-input" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} min="0" /></label>
            <label className="form-label">Cook Time (min)<input type="number" className="form-input" value={cookTime} onChange={(e) => setCookTime(e.target.value)} min="0" /></label>
            <label className="form-label">Servings<input type="number" className="form-input" value={servings} onChange={(e) => setServings(e.target.value)} min="1" /></label>
          </div>

          <fieldset className="form-fieldset">
            <legend className="form-legend">Ingredients</legend>
            {ingredients.map((ing, i) => (
              <div key={i} className="ingredient-row">
                <input type="text" className="form-input" placeholder="Amount" value={ing.amount} onChange={(e) => updateIngredient(i, "amount", e.target.value)} style={{ flex: "0 0 80px" }} />
                <input type="text" className="form-input" placeholder="Unit" value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} style={{ flex: "0 0 80px" }} />
                <input type="text" className="form-input" placeholder="Ingredient name" value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} style={{ flex: 1 }} />
                {ingredients.length > 1 && <button type="button" className="btn-icon-remove" onClick={() => removeIngredient(i)}>×</button>}
              </div>
            ))}
            <button type="button" className="btn-add-row" onClick={addIngredient}>+ Add Ingredient</button>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend className="form-legend">Instructions</legend>
            {instructions.map((step, i) => (
              <div key={i} className="instruction-row">
                <span className="step-number">{i + 1}.</span>
                <textarea className="form-textarea" value={step} onChange={(e) => updateInstruction(i, e.target.value)} rows={2} style={{ flex: 1 }} />
                {instructions.length > 1 && <button type="button" className="btn-icon-remove" onClick={() => removeInstruction(i)}>×</button>}
              </div>
            ))}
            <button type="button" className="btn-add-row" onClick={addInstruction}>+ Add Step</button>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend className="form-legend">Nutrition (per serving)</legend>
            <div className="macros-grid">
              <label className="form-label">Calories<input type="number" className="form-input" value={calories} onChange={(e) => setCalories(e.target.value)} min="0" /></label>
              <label className="form-label">Protein (g)<input type="number" className="form-input" value={protein} onChange={(e) => setProtein(e.target.value)} min="0" step="0.1" /></label>
              <label className="form-label">Carbs (g)<input type="number" className="form-input" value={carbs} onChange={(e) => setCarbs(e.target.value)} min="0" step="0.1" /></label>
              <label className="form-label">Fat (g)<input type="number" className="form-input" value={fat} onChange={(e) => setFat(e.target.value)} min="0" step="0.1" /></label>
            </div>
          </fieldset>

          <div className="form-label">
            Category
            <select className="form-select" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.emoji ? `${cat.emoji} ` : ""}{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-label">
            Tags
            <div className="tag-input-row">
              <input type="text" className="form-input" placeholder="Add a tag and press Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} style={{ flex: 1 }} />
              <button type="button" className="btn-secondary" onClick={addTag} style={{ padding: "0.5rem 1rem" }}>Add</button>
            </div>
            {tags.length > 0 && (
              <div className="tag-list">
                {tags.map((tag) => (
                  <span key={tag} className="tag-chip">{tag}<button type="button" className="tag-remove" onClick={() => removeTag(tag)}>×</button></span>
                ))}
              </div>
            )}
          </div>

          <label className="form-label">Notes<textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>
          <label className="form-label">Source URL<input type="url" className="form-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} /></label>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
```

**Step 2: Verify**

Run: `npm run dev`
Navigate to a recipe detail page and click "Edit". The form should be pre-filled with all existing data. Make a change, save, and verify it updates on the detail page.

**Step 3: Commit**

```bash
git add src/app/recipes/\\[id\\]/edit/page.tsx
git commit -m "added recipe edit page"
```

---

### Task 13: Recipe delete with confirmation

**Files:**
- Modify: `src/app/recipes/[id]/page.tsx`

**Step 1: Add delete handler to recipe detail page**

In `src/app/recipes/[id]/page.tsx`, add a delete function:

```tsx
async function handleDelete() {
  if (!recipe) return;
  const confirmed = window.confirm(`Delete "${recipe.title}"? This can't be undone.`);
  if (!confirmed) return;

  await supabase.from("recipe_tags").delete().eq("recipe_id", recipe.id);
  await supabase.from("recipe_categories").delete().eq("recipe_id", recipe.id);
  await supabase.from("recipe_photos").delete().eq("recipe_id", recipe.id);
  await supabase.from("recipes").delete().eq("id", recipe.id);

  router.push("/recipes");
}
```

Add a delete button in `recipe-detail-actions` next to the Edit link:

```tsx
<div className="recipe-detail-actions">
  <Link href={`/recipes/${recipe.id}/edit`} className="btn-primary">Edit</Link>
  <button type="button" className="btn-danger" onClick={handleDelete}>Delete</button>
</div>
```

**Step 2: Add danger button CSS**

In `src/app/globals.css`, add:

```css
.btn-danger {
  background: transparent;
  border: 1px solid #e8a0a0;
  border-radius: 0.25rem;
  color: #c44;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.6rem 1.5rem;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #fde8e8;
}
```

**Step 3: Verify**

Run: `npm run dev`
On a recipe detail page, click "Delete". A browser confirmation dialog appears. Confirming deletes the recipe and related data, redirects to /recipes.

**Step 4: Commit**

```bash
git add src/app/recipes/\\[id\\]/page.tsx src/app/globals.css
git commit -m "added recipe delete with confirmation"
```

---

### Task 14: Link recipe cards to detail pages + update search results

**Files:**
- Modify: `src/app/page.tsx` (dashboard recipe cards)
- Modify: `src/app/recipes/page.tsx` (recipes list)
- Modify: `src/app/favorites/page.tsx` (favorites list)
- Modify: `src/components/app-shell.tsx` (search results)

**Step 1: Update dashboard recipe cards to link**

In `src/app/page.tsx`, ensure `Link` is imported, then wrap each recipe card:

Change:
```tsx
<article key={recipe.id} className="recipe-card">
```
To:
```tsx
<Link key={recipe.id} href={`/recipes/${recipe.id}`} className="recipe-card" style={{ textDecoration: "none" }}>
```

And close with `</Link>` instead of `</article>`. Do the same for favorite cards.

**Step 2: Update /recipes page cards to link**

In `src/app/recipes/page.tsx`, import `Link` and change `<article>` to `<Link href={/recipes/${recipe.id}}>`.

**Step 3: Update /favorites page cards to link**

Same change in `src/app/favorites/page.tsx`.

**Step 4: Update search results to link**

In `src/components/app-shell.tsx`, import `Link` (already imported). Change search results from `<div>` to `<Link>`:

```tsx
{searchResults.map((r) => (
  <Link key={r.id} href={`/recipes/${r.id}`} className="search-result" style={{ textDecoration: "none", display: "block" }}>
    {r.title}
  </Link>
))}
```

**Step 5: Verify**

Run: `npm run dev`
Click any recipe card on dashboard, recipes, or favorites page → navigates to recipe detail. Click a search result → navigates to recipe detail.

**Step 6: Commit**

```bash
git add src/app/page.tsx src/app/recipes/page.tsx src/app/favorites/page.tsx src/components/app-shell.tsx
git commit -m "linked recipe cards and search results to detail pages"
```

---

### Task 15: Recipe card improvements — cover image + favorite heart

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`
- Modify: `src/app/recipes/page.tsx`

**Step 1: Update recipe card to show cover image**

In `src/app/page.tsx`, update the recent recipes card JSX to include the image:

```tsx
<Link key={recipe.id} href={`/recipes/${recipe.id}`} className="recipe-card" style={{ textDecoration: "none" }}>
  {recipe.cover_image_url && (
    <img src={recipe.cover_image_url} alt={recipe.title} className="recipe-card-img" />
  )}
  <div className="recipe-info">
    <span className="recipe-name">{recipe.title}</span>
    {recipe.category_name && <span className="recipe-tag">{recipe.category_name}</span>}
  </div>
</Link>
```

Do the same in `src/app/recipes/page.tsx`.

**Step 2: Add recipe card image CSS**

In `src/app/globals.css`, add:

```css
.recipe-card-img {
  border-radius: 0.25rem 0.25rem 0 0;
  display: block;
  height: 140px;
  object-fit: cover;
  width: 100%;
}
```

**Step 3: Verify**

Run: `npm run dev`
Recipe cards with cover images show the image above the title. Cards without images just show the text.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/recipes/page.tsx src/app/globals.css
git commit -m "added cover images to recipe cards"
```

---

### Task 16: Tag filtering on recipes page

**Files:**
- Modify: `src/app/recipes/page.tsx`

**Step 1: Add tag filter state and UI**

In `src/app/recipes/page.tsx`, update the component:

```tsx
const [allTags, setAllTags] = useState<string[]>([]);
const [activeTag, setActiveTag] = useState<string | null>(null);
```

In the useEffect, add a tag fetch:

```tsx
async function fetchTags() {
  const { data } = await supabase
    .from("recipe_tags")
    .select("tag");
  if (data) {
    const unique = [...new Set(data.map((t: any) => t.tag))];
    setAllTags(unique.sort());
  }
}
fetchTags();
```

Add a function to fetch filtered recipes:

```tsx
async function fetchFiltered(tag: string | null) {
  setActiveTag(tag);
  setLoading(true);

  if (!tag) {
    // Fetch all
    const { data } = await supabase
      .from("recipes")
      .select("id, title, cover_image_url, recipe_categories(categories(name))")
      .order("created_at", { ascending: false });
    if (data) {
      setRecipes(data.map((r: any) => ({
        id: r.id, title: r.title, cover_image_url: r.cover_image_url,
        category_name: r.recipe_categories?.[0]?.categories?.name ?? null,
      })));
    }
  } else {
    // Fetch by tag
    const { data } = await supabase
      .from("recipe_tags")
      .select("recipes(id, title, cover_image_url, recipe_categories(categories(name)))")
      .eq("tag", tag);
    if (data) {
      setRecipes(
        data.map((rt: any) => ({
          id: rt.recipes.id,
          title: rt.recipes.title,
          cover_image_url: rt.recipes.cover_image_url,
          category_name: rt.recipes.recipe_categories?.[0]?.categories?.name ?? null,
        }))
      );
    }
  }
  setLoading(false);
}
```

Add tag filter chips JSX above the recipe grid:

```tsx
{allTags.length > 0 && (
  <div className="tag-filter-row">
    <button
      type="button"
      className={`tag-filter-chip ${activeTag === null ? "active" : ""}`}
      onClick={() => fetchFiltered(null)}
    >
      All
    </button>
    {allTags.map((tag) => (
      <button
        key={tag}
        type="button"
        className={`tag-filter-chip ${activeTag === tag ? "active" : ""}`}
        onClick={() => fetchFiltered(tag)}
      >
        {tag}
      </button>
    ))}
  </div>
)}
```

**Step 2: Add tag filter CSS**

In `src/app/globals.css`, add:

```css
/* ── Tag filters ─────────────────────────────────────── */

.tag-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.tag-filter-chip {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  color: var(--color-text);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.3rem 0.8rem;
  transition: background 0.2s, border-color 0.2s;
}

.tag-filter-chip:hover {
  background: #fef0f3;
}

.tag-filter-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
```

**Step 3: Verify**

Run: `npm run dev`
Navigate to /recipes. If recipes have tags, tag filter chips appear above the grid. Clicking a tag filters recipes. Clicking "All" shows everything.

**Step 4: Commit**

```bash
git add src/app/recipes/page.tsx src/app/globals.css
git commit -m "added tag filtering on recipes page"
```

---

### Task 17: Final build check

**Step 1: Run the build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Manual smoke test**

Run: `npm run dev` and verify:
- [ ] `/recipes/new` — form loads, all fields work
- [ ] Import URL auto-fills form
- [ ] Saving a recipe works and redirects to detail
- [ ] Detail page shows all data, ingredient checkboxes work
- [ ] Favorite toggle works
- [ ] Edit page pre-fills and saves
- [ ] Delete with confirmation works
- [ ] Recipe cards link to detail
- [ ] Search results link to detail
- [ ] Tag filtering works on /recipes

**Step 3: Fix any build/lint issues and commit**

```bash
git add -A
git commit -m "phase 3 recipe crud and url import complete"
```
