"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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
  const [copied, setCopied] = useState(false);

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
          (catsResult.data as unknown as CategoryJoin[]).map((rc) => rc.categories).filter(Boolean)
        );
      }
      setLoading(false);
    }
    fetchRecipe();
  }, [recipeId]);

  function toggleIngredient(index: number) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  async function toggleFavorite() {
    if (!recipe) return;
    const newVal = !recipe.is_favorite;
    await supabase.from("recipes").update({ is_favorite: newVal }).eq("id", recipe.id);
    setRecipe({ ...recipe, is_favorite: newVal });
  }

  function copyShareLink() {
    if (!recipe) return;
    const shareUrl = `${window.location.origin}/share/${recipe.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  if (loading) return <AppShell><p className="empty-state-text">Loading...</p></AppShell>;
  if (!recipe) return <AppShell><p className="empty-state-text">Recipe not found.</p></AppShell>;

  const hasMacros = recipe.calories || recipe.protein || recipe.carbs || recipe.fat;

  return (
    <AppShell>
      <div className="recipe-detail">
        {recipe.cover_image_url && (
          <Image
            src={recipe.cover_image_url}
            alt={recipe.title}
            className="recipe-detail-hero"
            width={1200}
            height={800}
            unoptimized
          />
        )}
        <div className="recipe-detail-header">
          <h1 className="recipe-detail-title">{recipe.title}</h1>
          <button type="button" className={`favorite-btn ${recipe.is_favorite ? "favorited" : ""}`} onClick={toggleFavorite} aria-label={recipe.is_favorite ? "Remove from favorites" : "Add to favorites"}>
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
              <Link key={cat.id} href={`/categories/${cat.id}`} className="tag-chip">{cat.emoji ? `${cat.emoji} ` : ""}{cat.name}</Link>
            ))}
          </div>
        )}
        {tags.length > 0 && (
          <div className="recipe-detail-tags">
            {tags.map((tag) => (<span key={tag} className="tag-chip">{tag}</span>))}
          </div>
        )}
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
            <ul className="ingredient-checklist">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className={`ingredient-check-item ${checkedIngredients.has(i) ? "checked" : ""}`} onClick={() => toggleIngredient(i)}>
                  <input type="checkbox" checked={checkedIngredients.has(i)} onChange={() => toggleIngredient(i)} className="ingredient-checkbox" />
                  <span>{ing.amount && `${ing.amount} `}{ing.unit && `${ing.unit} `}{ing.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {recipe.instructions?.length > 0 && (
          <section className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Instructions</h2>
            <ol className="instruction-list">
              {recipe.instructions.map((step, i) => (<li key={i} className="instruction-step">{step.text}</li>))}
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
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="source-link">View original recipe</a>
        )}
        <div className="recipe-detail-actions">
          <button type="button" className="btn-secondary" onClick={copyShareLink}>
            {copied ? "Copied!" : "Share"}
          </button>
          <Link href={`/recipes/${recipe.id}/edit`} className="btn-primary">Edit</Link>
          <button type="button" className="btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </AppShell>
  );
}
