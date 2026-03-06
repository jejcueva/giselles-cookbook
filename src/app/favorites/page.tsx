"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  category_name: string | null;
};

type CategoryNode = { name: string | null };
type RecipeCategoryRelation = {
  categories: CategoryNode | CategoryNode[] | null;
};

type FavoriteRecipeRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
  recipe_categories: RecipeCategoryRelation[] | null;
};

function getCategoryName(relations: FavoriteRecipeRow["recipe_categories"]): string | null {
  const categories = relations?.[0]?.categories;
  if (!categories) return null;
  return Array.isArray(categories) ? categories[0]?.name ?? null : categories.name;
}

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
            category_name: getCategoryName(recipe.recipe_categories),
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
                  <Image
                    src={recipe.cover_image_url}
                    alt={recipe.title}
                    className="recipe-card-img"
                    width={640}
                    height={360}
                    unoptimized
                  />
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
