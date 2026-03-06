"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  category_name: string | null;
};

type FavoriteRecipeRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
  recipe_categories:
    | Array<{ categories: { name: string | null } | null } | null>
    | null;
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
        const rows = data as FavoriteRecipeRow[];
        setFavorites(
          rows.map((recipe) => ({
            id: recipe.id,
            title: recipe.title,
            cover_image_url: recipe.cover_image_url,
            category_name: recipe.recipe_categories?.[0]?.categories?.name ?? null,
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
              <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="recipe-card" style={{ textDecoration: "none", flexDirection: "column", alignItems: "stretch" }}>
                {recipe.cover_image_url && (
                  <img src={recipe.cover_image_url} alt={recipe.title} className="recipe-card-img" />
                )}
                <div className="recipe-info">
                  <span className="recipe-name">{recipe.title}</span>
                  {recipe.category_name && <span className="recipe-tag">{recipe.category_name}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
