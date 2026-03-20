"use client";

import { AppShell } from "@/components/app-shell";
import { RecipeCard } from "@/features/recipes";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

type RecipeCategoryRow = {
  recipes: Recipe[] | Recipe | null;
};

export default function CategoryDetailPage() {
  const params = useParams();
  const categoryId = params.id as string;
  const [category, setCategory] = useState<Category | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingEmoji, setUpdatingEmoji] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const router = useRouter();

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
          (recipesResult.data as RecipeCategoryRow[])
            .flatMap((row) =>
              Array.isArray(row.recipes)
                ? row.recipes
                : row.recipes
                  ? [row.recipes]
                  : []
            )
        );
      }
      setLoading(false);
    }
    fetchData();
  }, [categoryId]);

  useEffect(() => {
    if (category?.name) {
      setNameInput(category.name);
    }
  }, [category?.name]);

  async function handleClearEmoji() {
    if (!category || !category.emoji || updatingEmoji) return;
    setUpdatingEmoji(true);
    try {
      await supabase.from("categories").update({ emoji: null }).eq("id", categoryId);
      setCategory({ ...category, emoji: null });
    } finally {
      setUpdatingEmoji(false);
    }
  }

  async function handleDeleteCategory() {
    if (!category || deleting) return;
    const confirmed = window.confirm(
      `Delete the "${category.name}" category? Recipes will stay, but they will no longer be linked to this category.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await supabase.from("recipe_categories").delete().eq("category_id", categoryId);
      await supabase.from("categories").delete().eq("id", categoryId);
      router.push("/categories");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRenameCategory() {
    if (!category || renaming) return;
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === category.name) return;

    setRenaming(true);
    try {
      await supabase.from("categories").update({ name: trimmed }).eq("id", categoryId);
      setCategory({ ...category, name: trimmed });
      setShowSettings(false);
    } finally {
      setRenaming(false);
    }
  }

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
        <div className="category-header-row">
          <h1 className="section-title">
            {category?.emoji && `${category.emoji} `}{category?.name ?? "Category"}
          </h1>
          {category && (
            <button
              type="button"
              className="btn-icon-ghost"
              aria-label="Category settings"
              onClick={() => setShowSettings((v) => !v)}
            >
              ⚙️
            </button>
          )}
        </div>
        {category && showSettings && (
          <div className="category-settings-panel">
            <div className="category-settings-row">
              {category.emoji && (
                <button
                  type="button"
                  className="btn-icon-remove"
                  onClick={handleClearEmoji}
                  disabled={updatingEmoji}
                  aria-label={updatingEmoji ? "Removing emoji" : "Remove emoji"}
                >
                  ×
                </button>
              )}
              <input
                type="text"
                className="form-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Category name"
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleRenameCategory}
                disabled={renaming || !nameInput.trim() || nameInput.trim() === category.name}
              >
                {renaming ? "Saving..." : "Save"}
              </button>
            </div>
            <button
              type="button"
              className="btn-danger category-settings-delete"
              onClick={handleDeleteCategory}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete category"}
            </button>
          </div>
        )}
        {recipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No recipes in this category yet.</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                coverImageUrl={recipe.cover_image_url}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
