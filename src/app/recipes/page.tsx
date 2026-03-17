"use client";

import { AppShell } from "@/components/app-shell";
import { RecipeCard } from "@/components/recipe-card";
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

type RecipeRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
  recipe_categories: CategoryRelation[] | null;
};

function getRecipeCategories(relations: RecipeRow["recipe_categories"]): Category[] {
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

function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    cover_image_url: row.cover_image_url,
    categories: getRecipeCategories(row.recipe_categories),
  };
}

async function withResolvedImages(recipes: Recipe[]): Promise<Recipe[]> {
  const resolved = await Promise.all(
    recipes.map(async (recipe) => ({
      ...recipe,
      cover_image_url: await resolveCoverImageUrl(recipe.cover_image_url),
    }))
  );
  return resolved;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function fetchData() {
      setLoading(true);

      const [recipesResult, categoriesResult] = await Promise.all([
        supabase
          .from("recipes")
          .select("id, title, cover_image_url, recipe_categories(categories(id, name, emoji))")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name, emoji").order("name"),
      ]);

      if (!isActive) {
        return;
      }

      const recipeRows = (recipesResult.data as RecipeRow[] | null) ?? [];
      const categoryRows = (categoriesResult.data as Category[] | null) ?? [];

      const mapped = recipeRows.map(mapRecipe);
      setRecipes(await withResolvedImages(mapped));
      setCategories(
        categoryRows.filter((category) => Boolean(category.id && category.name))
      );
      setLoading(false);
    }

    void fetchData();

    return () => {
      isActive = false;
    };
  }, []);

  function toggleCategory(categoryId: string) {
    setActiveCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  }

  async function createCategory() {
    const name = newTagName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("categories")
      .insert({ name })
      .select("id, name, emoji")
      .single();
    if (error || !data) return;
    setCategories((prev) => [...prev, data]);
    setNewTagName("");
    setShowNewTag(false);
  }

  const filteredRecipes =
    activeCategoryIds.length === 0
      ? recipes
      : recipes.filter((recipe) =>
          recipe.categories.some((category) =>
            activeCategoryIds.includes(category.id)
          )
        );

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">Recipes</h1>
        <p className="section-subtitle">
          Use Filters to choose categories and refine the recipes below.
        </p>

        {categories.length > 0 && (
          <div className="filters-top-row" aria-label="Recipe filters">
            <button
              type="button"
              className={`tag-filter-chip filters-trigger ${
                filtersOpen || activeCategoryIds.length > 0 ? "active" : ""
              }`}
              onClick={() => setFiltersOpen(true)}
            >
              <span>Filters</span>
              <span className="filters-count">
                {activeCategoryIds.length}
              </span>
            </button>
            {activeCategoryIds.length > 0 && (
              <button
                type="button"
                className="tag-filter-chip filters-clear"
                onClick={() => {
                  setActiveCategoryIds([]);
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p className="empty-state-text">Loading...</p>
        ) : filteredRecipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">
              {activeCategoryIds.length === 0
                ? "No recipes yet - add your first one!"
                : "No recipes match those category tags yet."}
            </p>
          </div>
        ) : (
          <div className="recipe-grid">
            {filteredRecipes.map((recipe) => (
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

        {filtersOpen && categories.length > 0 && (
          <div
            className="filters-sheet-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Filter recipes"
            onClick={() => setFiltersOpen(false)}
          >
            <div className="filters-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="filters-sheet-header">
                <h2 className="filters-sheet-title">Filters</h2>
                <button
                  type="button"
                  className="filters-done-button"
                  onClick={() => setFiltersOpen(false)}
                >
                  Done
                </button>
              </div>

              <div className="filters-section">
                <div className="filters-section-label">Categories</div>
                <div
                  className="filters-chips-row"
                  role="group"
                  aria-label="Filter recipes by category"
                >
                  <button
                    type="button"
                    className={`tag-filter-chip ${
                      activeCategoryIds.length === 0 ? "active" : ""
                    }`}
                    onClick={() => setActiveCategoryIds([])}
                  >
                    All
                  </button>
                  {categories.map((category) => {
                    const isActive = activeCategoryIds.includes(category.id);

                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`tag-filter-chip ${
                          isActive ? "active" : ""
                        }`}
                        onClick={() => toggleCategory(category.id)}
                        aria-pressed={isActive}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="tag-filter-chip tag-filter-add"
                    onClick={() => setShowNewTag((v) => !v)}
                  >
                    +
                  </button>
                </div>

                {showNewTag && (
                  <div className="filters-new-category-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Category name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createCategory();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={createCategory}
                      style={{ padding: "0.5rem 1rem" }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
