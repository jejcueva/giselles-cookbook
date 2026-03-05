"use client";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  emoji: string | null;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("categories")
        .select("id, name, emoji")
        .order("name");
      if (data) setCategories(data);
    }
    fetch();
  }, []);

  return (
    <AppShell>
      <section className="dashboard-section">
        <h1 className="section-title">Categories</h1>
        {categories.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No categories yet</p>
          </div>
        ) : (
          <div className="category-grid">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.id}`} className="category-card">
                {cat.emoji && <span className="category-emoji">{cat.emoji}</span>}
                <span className="category-label">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
