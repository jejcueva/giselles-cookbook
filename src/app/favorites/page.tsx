"use client";

import { AppShell } from "@/components/app-shell";
import { RecipeCard } from "@/features/recipes";
import { supabase } from "@/lib/supabase";
import { resolveCoverImageUrl } from "@/lib/storage-images";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  emoji: string | null;
};

type CategoryRelation = {
  categories: Category | Category[] | null;
};

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  categories: Category[];
};

type FavoriteRecipeRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
  recipe_categories: CategoryRelation[] | null;
};

function getRecipeCategories(relations: FavoriteRecipeRow["recipe_categories"]): Category[] {
  const seen = new Set<string>();
  const categories: Category[] = [];

  for (const relation of relations ?? []) {
    const nodes = relation?.categories;
    const categoryList = Array.isArray(nodes) ? nodes : nodes ? [nodes] : [];

    for (const category of categoryList) {
      if (!category?.id || !category.name || seen.has(category.id)) {
        continue;
      }

      seen.add(category.id);
      categories.push({
        id: category.id,
        name: category.name,
        emoji: category.emoji ?? null,
      });
    }
  }

  return categories;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFavs() {
      const { data } = await supabase
        .from("recipes")
        .select(
          "id, title, cover_image_url, recipe_categories(categories(id, name, emoji))"
        )
        .eq("is_favorite", true)
        .order("created_at", { ascending: false });

      const rows = (data as FavoriteRecipeRow[] | null) ?? [];
      const mapped = rows.map((row) => ({
          id: row.id,
          title: row.title,
          cover_image_url: row.cover_image_url,
          categories: getRecipeCategories(row.recipe_categories),
        }));

      const resolved = await Promise.all(
        mapped.map(async (recipe) => ({
          ...recipe,
          cover_image_url: await resolveCoverImageUrl(recipe.cover_image_url),
        }))
      );

      setFavorites(resolved);

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
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                coverImageUrl={recipe.cover_image_url}
                categories={recipe.categories}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
