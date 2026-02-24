import { AppShell } from "@/components/app-shell";

const RECENT_RECIPES = [
  "Brown Butter Cookies",
  "Creamy Garlic Pasta",
  "Strawberry Shortcake",
  "One Pot Curry",
];

const FAVORITES = ["Honey Toast", "Miso Ramen", "Blueberry Muffins"];

const CATEGORIES = ["Desserts", "Dinner", "Quick Meals", "Soup"];

export default function Home() {
  return (
    <AppShell>
      <section className="panel">
        <h1>Welcome back, Jizzy.</h1>
        <p>This is your cozy dashboard for all saved recipes.</p>
      </section>

      <section className="panel">
        <h2>Recent Recipes</h2>
        <div className="chip-grid">
          {RECENT_RECIPES.map((recipe) => (
            <article key={recipe} className="chip-card">
              {recipe}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Favorites</h2>
        <div className="chip-grid">
          {FAVORITES.map((recipe) => (
            <article key={recipe} className="chip-card">
              {recipe}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Categories</h2>
        <div className="chip-grid">
          {CATEGORIES.map((category) => (
            <article key={category} className="chip-card">
              {category}
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
