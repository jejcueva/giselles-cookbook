"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  ingredients: IngredientItem[];
  instructions: InstructionItem[];
  notes: string | null;
  cook_time: number | null;
  prep_time: number | null;
  servings: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type IngredientItem = {
  name?: string;
  amount?: string;
  unit?: string;
} | string;

type InstructionItem = {
  text?: string;
} | string;

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
              {recipe.ingredients.map((ingredient, i) => (
                <li key={i}>
                  {typeof ingredient !== "string" && ingredient.amount && `${ingredient.amount} `}
                  {typeof ingredient !== "string" && ingredient.unit && `${ingredient.unit} `}
                  {typeof ingredient === "string" ? ingredient : ingredient.name || ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {recipe.instructions.length > 0 && (
          <div className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Instructions</h2>
            <ol className="instruction-list">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="instruction-step">
                  {typeof step === "string" ? step : step.text || ""}
                </li>
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

        <p className="share-footer">Made with Jizzy&apos;s Cookbook</p>
      </article>
    </div>
  );
}
