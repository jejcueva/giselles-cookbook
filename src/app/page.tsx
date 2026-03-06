"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useState, useEffect } from "react";
import Image from "next/image";

type Category = {
  id: string;
  name: string;
  emoji: string | null;
};

type Recipe = {
  id: string;
  title: string;
  cover_image_url: string | null;
  created_at: string;
  category_name: string | null;
};

type RecentRecipeRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
  created_at: string;
  recipe_categories:
    | Array<{ categories: { name: string | null } | null } | null>
    | null;
};

type FavoriteRecipeRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
};

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getGreeting(time: string) {
  if (time === "morning") return "Good morning, Jizzy";
  if (time === "afternoon") return "Good afternoon, Jizzy";
  return "Good evening, Jizzy";
}

type SunflowerProps = {
  size?: number;
  stemHeight?: number;
  leafCount?: number;
  petalRx?: number;
  petalRy?: number;
};

function Sunflower({ size = 48, stemHeight = 40, leafCount = 1, petalRx, petalRy }: SunflowerProps) {
  const totalH = size + stemHeight;
  const cx = size / 2;
  const pRx = petalRx ?? size * 0.1;
  const pRy = petalRy ?? size * 0.21;

  const leaves = [];
  for (let i = 0; i < leafCount; i++) {
    const t = 0.25 + (i * 0.4) / Math.max(leafCount - 1, 1);
    const yPos = size * 0.85 + stemHeight * t;
    const side = i % 2 === 0 ? -1 : 1;
    leaves.push(
      <path
        key={i}
        d={`M${cx + side * 2} ${yPos} Q${cx + side * 16} ${yPos - stemHeight * 0.12} ${cx + side * 4} ${yPos - stemHeight * 0.18}`}
        stroke="#6a994e"
        strokeWidth="1.5"
        fill="#a7c957"
        opacity="0.7"
      />
    );
  }

  return (
    <svg width={size} height={totalH} viewBox={`0 0 ${size} ${totalH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d={`M${cx} ${size * 0.85} Q${cx - 6} ${size + stemHeight * 0.4} ${cx + 2} ${totalH}`}
        stroke="#6a994e"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {leaves}
      <g transform={`translate(${cx}, ${size / 2})`}>
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
          <ellipse
            key={angle}
            cx="0"
            cy={-size * 0.29}
            rx={pRx}
            ry={pRy}
            fill="#f5c542"
            transform={`rotate(${angle})`}
          />
        ))}
        <circle r={size * 0.19} fill="#8d6e63" />
        <circle r={size * 0.125} fill="#6d4c41" />
      </g>
    </svg>
  );
}

function Sun() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="26" cy="26" r="12" fill="#f5c542" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 26 + Math.cos(rad) * 16;
        const y1 = 26 + Math.sin(rad) * 16;
        const x2 = 26 + Math.cos(rad) * 22;
        const y2 = 26 + Math.sin(rad) * 22;
        return (
          <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f5c542" strokeWidth="2.5" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

function Moon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="26" cy="26" r="14" fill="#f5e6a3" />
      <circle cx="34" cy="20" r="13" fill="var(--color-surface)" />
      <circle cx="12" cy="10" r="1.5" fill="#f5e6a3" opacity="0.7" />
      <circle cx="44" cy="40" r="1.8" fill="#f5e6a3" opacity="0.6" />
      <circle cx="8" cy="40" r="1.2" fill="#f5e6a3" opacity="0.5" />
    </svg>
  );
}

function SkyIcon({ time }: { time: string }) {
  if (time === "evening") return <Moon />;
  return <Sun />;
}

export default function Home() {
  const [time] = useState(getTimeOfDay);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function fetchRecent() {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, cover_image_url, created_at, recipe_categories(categories(name))")
        .order("created_at", { ascending: false })
        .limit(6);

      if (data) {
        const rows = data as RecentRecipeRow[];
        setRecipes(
          rows.map((recipe) => ({
            id: recipe.id,
            title: recipe.title,
            cover_image_url: recipe.cover_image_url,
            created_at: recipe.created_at,
            category_name: recipe.recipe_categories?.[0]?.categories?.name ?? null,
          }))
        );
      }
      setLoadingRecipes(false);
    }
    fetchRecent();

    async function fetchFavorites() {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, cover_image_url")
        .eq("is_favorite", true)
        .limit(6);

      if (data) {
        const rows = data as FavoriteRecipeRow[];
        setFavorites(
          rows.map((recipe) => ({
            id: recipe.id,
            title: recipe.title,
            cover_image_url: recipe.cover_image_url,
            created_at: "",
            category_name: null,
          }))
        );
      }
      setLoadingFavorites(false);
    }
    fetchFavorites();

    async function fetchCategories() {
      const { data } = await supabase
        .from("categories")
        .select("id, name, emoji")
        .order("name");
      if (data) setCategories(data);
    }
    fetchCategories();
  }, []);

  return (
    <AppShell>
      <section className="hero-panel">
        <div className="hero-inner">
          {/* left 5 flowers — spread across left half, under text */}
          <div className="hero-side">
            <div className="flower-scatter" style={{ top: "52%", left: "2%" }}><Sunflower size={44} stemHeight={42} leafCount={3} petalRx={5} petalRy={11} /></div>
            <div className="flower-scatter" style={{ top: "62%", left: "14%" }}><Sunflower size={30} stemHeight={30} leafCount={1} petalRx={3.5} petalRy={7} /></div>
            <div className="flower-scatter" style={{ top: "46%", left: "24%" }}><Sunflower size={52} stemHeight={48} leafCount={2} petalRx={6} petalRy={13} /></div>
            <div className="flower-scatter" style={{ top: "64%", left: "35%" }}><Sunflower size={26} stemHeight={22} leafCount={1} petalRx={3} petalRy={6} /></div>
            <div className="flower-scatter" style={{ top: "50%", left: "44%" }}><Sunflower size={34} stemHeight={32} leafCount={2} petalRx={4} petalRy={8} /></div>
          </div>
          <div className="hero-center">
            <SkyIcon time={time} />
            <h1 className="hero-title">{getGreeting(time)}</h1>
          </div>
          {/* right 6 flowers — spread across right half, under text */}
          <div className="hero-side">
            <div className="flower-scatter" style={{ top: "48%", left: "56%" }}><Sunflower size={48} stemHeight={44} leafCount={3} petalRx={5.5} petalRy={12} /></div>
            <div className="flower-scatter" style={{ top: "60%", left: "64%" }}><Sunflower size={32} stemHeight={28} leafCount={1} petalRx={3.5} petalRy={7.5} /></div>
            <div className="flower-scatter" style={{ top: "44%", left: "72%" }}><Sunflower size={40} stemHeight={38} leafCount={2} petalRx={4.5} petalRy={10} /></div>
            <div className="flower-scatter" style={{ top: "64%", left: "80%" }}><Sunflower size={28} stemHeight={24} leafCount={1} petalRx={3} petalRy={6.5} /></div>
            <div className="flower-scatter" style={{ top: "50%", left: "87%" }}><Sunflower size={36} stemHeight={34} leafCount={2} petalRx={4} petalRy={9} /></div>
            <div className="flower-scatter" style={{ top: "66%", left: "93%" }}><Sunflower size={24} stemHeight={20} leafCount={1} petalRx={2.8} petalRy={5.5} /></div>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">Recent Recipes</h2>
        {loadingRecipes ? (
          <p className="empty-state-text">Loading...</p>
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No recipes yet — add your first one!</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="recipe-card" style={{ textDecoration: "none" }}>
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
                  {recipe.category_name && (
                    <span className="recipe-tag">{recipe.category_name}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">Favorites</h2>
        {loadingFavorites ? (
          <p className="empty-state-text">Loading...</p>
        ) : favorites.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Heart a recipe to see it here</p>
          </div>
        ) : (
          <div className="favorites-row">
            {favorites.map((fav) => (
              <Link key={fav.id} href={`/recipes/${fav.id}`} className="favorite-card" style={{ textDecoration: "none" }}>
                <span className="favorite-name">{fav.title}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">Categories</h2>
        <div className="category-grid">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/categories/${cat.id}`} className="category-card">
              {cat.emoji && <span className="category-emoji">{cat.emoji}</span>}
              <span className="category-label">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">Your Birthday Letter</h2>
        <div className="empty-state">
          <div>
            <p className="empty-state-text">Want to reread your birthday love letter?</p>
            <Link href="/letter" className="letter-link">
              Read your letter &rarr;
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
