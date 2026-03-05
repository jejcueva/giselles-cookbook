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

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    fetchTags();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from("recipes")
      .select("id, title, cover_image_url, recipe_categories(categories(name))")
      .order("created_at", { ascending: false });
    if (data) {
      setRecipes(data.map((r: any) => ({
        id: r.id, title: r.title, cover_image_url: r.cover_image_url,
        category_name: r.recipe_categories?.[0]?.categories?.name ?? null,
      })));
    }
    setLoading(false);
  }

  async function fetchTags() {
    const { data } = await supabase.from("recipe_tags").select("tag");
    if (data) {
      const unique = [...new Set(data.map((t: any) => t.tag))];
      setAllTags(unique.sort());
    }
  }

  async function fetchFiltered(tag: string | null) {
    setActiveTag(tag);
    setLoading(true);
    if (!tag) {
      await fetchAll();
      return;
    }
    const { data } = await supabase
      .from("recipe_tags")
      .select("recipes(id, title, cover_image_url, recipe_categories(categories(name)))")
      .eq("tag", tag);
    if (data) {
      setRecipes(data.map((rt: any) => ({
        id: rt.recipes.id, title: rt.recipes.title, cover_image_url: rt.recipes.cover_image_url,
        category_name: rt.recipes.recipe_categories?.[0]?.categories?.name ?? null,
      })));
    }
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
            <p className="empty-state-text">No recipes yet — add your first one!</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
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
