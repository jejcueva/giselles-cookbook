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

type RecipeRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
  recipe_categories:
    | Array<{ categories: { name: string | null } | null } | null>
    | null;
};

type RecipeTagRow = {
  tag: string | null;
};

type TaggedRecipeRow = {
  recipes: RecipeRow | null;
};

function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    cover_image_url: row.cover_image_url,
    category_name: row.recipe_categories?.[0]?.categories?.name ?? null,
  };
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);

      const [recipesResult, tagsResult] = await Promise.all([
        supabase
          .from("recipes")
          .select("id, title, cover_image_url, recipe_categories(categories(name))")
          .order("created_at", { ascending: false }),
        supabase.from("recipe_tags").select("tag"),
      ]);

      const recipeRows = (recipesResult.data as RecipeRow[] | null) ?? [];
      setRecipes(recipeRows.map(mapRecipe));

      const tagRows = (tagsResult.data as RecipeTagRow[] | null) ?? [];
      const uniqueTags = [
        ...new Set(tagRows.map((row) => row.tag).filter((tag): tag is string => Boolean(tag))),
      ];
      setAllTags(uniqueTags.sort());

      setLoading(false);
    }

    void fetchInitialData();
  }, []);

  async function fetchFiltered(tag: string | null) {
    setActiveTag(tag);
    setLoading(true);

    if (!tag) {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, cover_image_url, recipe_categories(categories(name))")
        .order("created_at", { ascending: false });

      const rows = (data as RecipeRow[] | null) ?? [];
      setRecipes(rows.map(mapRecipe));
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("recipe_tags")
      .select("recipes(id, title, cover_image_url, recipe_categories(categories(name)))")
      .eq("tag", tag);

    const rows = (data as TaggedRecipeRow[] | null) ?? [];
    const filteredRows = rows
      .map((row) => row.recipes)
      .filter((recipe): recipe is RecipeRow => recipe !== null);

    setRecipes(filteredRows.map(mapRecipe));
    setLoading(false);
  }

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">All Recipes</h1>
        {allTags.length > 0 && (
          <div className="tag-filter-row">
            <button type="button" className={`tag-filter-chip ${activeTag === null ? "active" : ""}`} onClick={() => fetchFiltered(null)}>All</button>
            {allTags.map((tag) => (
              <button key={tag} type="button" className={`tag-filter-chip ${activeTag === tag ? "active" : ""}`} onClick={() => fetchFiltered(tag)}>{tag}</button>
            ))}
          </div>
        )}
        {loading ? (
          <p className="empty-state-text">Loading...</p>
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No recipes yet â€” add your first one!</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
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
