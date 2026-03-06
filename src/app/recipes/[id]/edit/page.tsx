"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

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
        if (r.instructions?.length) setInstructions(r.instructions.map((s: { text: string }) => s.text));
        if (r.cover_image_url) setCoverPreview(r.cover_image_url);
      }

      if (tagsResult.data) setTags(tagsResult.data.map((t: { tag: string }) => t.tag));
      if (catsResult.data?.[0]) setSelectedCategoryId((catsResult.data[0] as { category_id: string }).category_id);
      if (allCats.data) setCategories(allCats.data);

      setLoading(false);
    }
    fetchData();
  }, [recipeId]);

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

      await supabase.from("recipe_categories").delete().eq("recipe_id", recipeId);
      if (selectedCategoryId) {
        await supabase.from("recipe_categories").insert({ recipe_id: recipeId, category_id: selectedCategoryId });
      }

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

  if (loading) return <AppShell><p className="empty-state-text">Loading...</p></AppShell>;

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
                  <Image
                    src={coverPreview}
                    alt="Cover preview"
                    className="photo-preview"
                    width={640}
                    height={420}
                    unoptimized
                  />
                  <button type="button" className="btn-icon-remove photo-remove" onClick={() => { setCoverFile(null); setCoverPreview(null); }}>Ã—</button>
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
                {ingredients.length > 1 && <button type="button" className="btn-icon-remove" onClick={() => removeIngredient(i)}>Ã—</button>}
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
                {instructions.length > 1 && <button type="button" className="btn-icon-remove" onClick={() => removeInstruction(i)}>Ã—</button>}
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
                  <span key={tag} className="tag-chip">{tag}<button type="button" className="tag-remove" onClick={() => removeTag(tag)}>Ã—</button></span>
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


