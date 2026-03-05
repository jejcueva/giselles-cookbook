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
    async function fetchRecipes() {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, cover_image_url, recipe_categories ( categories ( name ) )")
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

    fetchRecipes();
  }, []);

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">Recipes</h1>
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
