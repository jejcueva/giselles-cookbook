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
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFavorites() {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, cover_image_url, recipe_categories ( categories ( name ) )")
        .eq("is_favorite", true)
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

    fetchFavorites();
  }, []);

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">Favorites</h1>
        {loading ? (
          <p className="empty-state-text">Loading...</p>
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Heart a recipe to see it here</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <article key={recipe.id} className="recipe-card">
                <div className="recipe-info">
                  <span className="recipe-name">{recipe.title}</span>
                  {recipe.category_name && <span className="recipe-tag">{recipe.category_name}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
