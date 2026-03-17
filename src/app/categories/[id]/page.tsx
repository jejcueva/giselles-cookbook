"use client";

import { AppShell } from "@/components/app-shell";
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
        {category && (
          <div className="category-detail-actions">
            {category.emoji && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClearEmoji}
                disabled={updatingEmoji}
              >
                {updatingEmoji ? "Removing emoji..." : "Remove emoji"}
              </button>
            )}
            <button
              type="button"
              className="btn-danger"
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
