"use client";

import { AppShell } from "@/components/app-shell";
import { IMPORT_PREFILL_KEY } from "@/components/new-recipe-modal";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Ingredient = { name: string; amount: string; unit: string };
type Category = { id: string; name: string; emoji: string | null };
type ImportPrefill = {
  title?: string;
  ingredients?: Ingredient[];
  instructions?: string[];
  cookTime?: number | null;
  prepTime?: number | null;
  servings?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  imageUrl?: string | null;
  sourceUrl?: string;
};

function readImportPrefill(): ImportPrefill | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(IMPORT_PREFILL_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ImportPrefill;
    sessionStorage.removeItem(IMPORT_PREFILL_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(IMPORT_PREFILL_KEY);
    return null;
  }
}

function NewRecipeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isManual = searchParams.get("manual") === "1";
  const [initialPrefill] = useState<ImportPrefill | null>(() => readImportPrefill());
  const [title, setTitle] = useState(initialPrefill?.title ?? "");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState(initialPrefill?.sourceUrl ?? "");
  const [cookTime, setCookTime] = useState(
    initialPrefill?.cookTime != null ? String(initialPrefill.cookTime) : ""
  );
  const [prepTime, setPrepTime] = useState(
    initialPrefill?.prepTime != null ? String(initialPrefill.prepTime) : ""
  );
  const [servings, setServings] = useState(
    initialPrefill?.servings != null ? String(initialPrefill.servings) : ""
  );

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialPrefill?.ingredients?.length
      ? initialPrefill.ingredients
      : [{ name: "", amount: "", unit: "" }]
  );

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

  // Instructions
  const [instructions, setInstructions] = useState<string[]>(
    initialPrefill?.instructions?.length ? initialPrefill.instructions : [""]
  );

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

  // Macros
  const [calories, setCalories] = useState(
    initialPrefill?.calories != null ? String(initialPrefill.calories) : ""
  );
  const [protein, setProtein] = useState(
    initialPrefill?.protein != null ? String(initialPrefill.protein) : ""
  );
  const [carbs, setCarbs] = useState(
    initialPrefill?.carbs != null ? String(initialPrefill.carbs) : ""
  );
  const [fat, setFat] = useState(initialPrefill?.fat != null ? String(initialPrefill.fat) : "");

  // Import from URL
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialPrefill?.imageUrl ?? null);

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

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  // Tags
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

  // Import handler
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
      if (data.imageUrl) setCoverPreview(data.imageUrl);
    } catch {
      setImportError("Something went wrong");
    }
    setImporting(false);
  }

  // Submit
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setSaveError("");

    try {
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

      // If no file but we have an external preview URL (from import), use it
      if (!coverImageUrl && coverPreview && !coverFile) {
        coverImageUrl = coverPreview;
      }

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
        setSaveError("Failed to save recipe. Please try again.");
        setSaving(false);
        return;
      }

      if (selectedCategoryId) {
        await supabase.from("recipe_categories").insert({
          recipe_id: recipe.id,
          category_id: selectedCategoryId,
        });
      }

      if (tags.length > 0) {
        await supabase.from("recipe_tags").insert(
          tags.map((tag) => ({ recipe_id: recipe.id, tag }))
        );
      }

      router.push(`/recipes/${recipe.id}`);
    } catch {
      setSaveError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="recipe-form-page">
        <nav className="recipe-form-nav" aria-label="Breadcrumb">
          <Link href="/recipes" className="recipe-form-back">← Back to recipes</Link>
        </nav>
        <h1 className="section-title">Add New Recipe</h1>
        {!isManual && (
          <p className="recipe-form-subtitle">Import from a blog URL or fill in the form below.</p>
        )}

        <form className="recipe-form" onSubmit={handleSubmit}>
          {!isManual && (
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
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleImport(); } }}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-primary" onClick={handleImport} disabled={importing || !importUrl.trim()} style={{ padding: "0.6rem 1.2rem" }}>
                    {importing ? "Importing..." : "Import"}
                  </button>
                </div>
                {importError && <p className="import-error">{importError}</p>}
              </label>
              <div className="import-divider"><span>or fill in manually</span></div>
            </div>
          )}

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

          {!isManual && (
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
          )}

          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="form-actions">
            <Link href="/recipes" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save Recipe"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default function NewRecipePage() {
  return (
    <Suspense fallback={<AppShell><p className="empty-state-text">Loading...</p></AppShell>}>
      <NewRecipeContent />
    </Suspense>
  );
}
