"use client";

import { ImportModal } from "@/components/import-modal";
import { NewRecipeModal } from "@/components/new-recipe-modal";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppShellProps = {
  children: React.ReactNode;
};

const SESSION_KEY = "cute-cookbook-authenticated";

type SearchResult = {
  id: string;
  title: string;
  category_name: string | null;
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/recipes", label: "Recipes" },
  { href: "/categories", label: "Categories" },
  { href: "/favorites", label: "Favorites" },
];

const UTILITY_ITEMS = [
  { href: "/ai-assistant", label: "AI Assistant" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newRecipeModalOpen, setNewRecipeModalOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsAuthenticated(localStorage.getItem(SESSION_KEY) === "true");
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, recipe_categories ( categories ( name ) )")
        .ilike("title", `%${searchQuery}%`)
        .limit(8);

      if (data) {
        setSearchResults(
          data.map((r: any) => ({
            id: r.id,
            title: r.title,
            category_name: r.recipe_categories?.[0]?.categories?.name ?? null,
          }))
        );
        setSearchOpen(true);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="loading-state">
        <p>Checking session...</p>
      </div>
    );
  }

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div>
          <div className="sidebar-header">
            {!collapsed && (
              <div className="sidebar-top">
                <p className="sidebar-label">Cute Cookbook</p>
                <h2 className="sidebar-title">Jizzy&apos;s Kitchen</h2>
              </div>
            )}
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="hamburger-icon" />
            </button>
          </div>

          <nav className="sidebar-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? "nav-link active" : "nav-link"}
                  title={collapsed ? item.label : undefined}
                >
                  {!collapsed && item.label}
                </Link>
              );
            })}

            <hr className="nav-divider" />

            {UTILITY_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? "nav-link active" : "nav-link"}
                  title={collapsed ? item.label : undefined}
                >
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={() => {
            localStorage.removeItem(SESSION_KEY);
            router.push("/login");
          }}
        >
          {collapsed ? "x" : "Log Out"}
        </button>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="search-wrapper">
            <input
              type="search"
              placeholder="Search recipes..."
              aria-label="Search recipes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((r) => (
                  <Link key={r.id} href={`/recipes/${r.id}`} className="search-result" style={{ textDecoration: "none", display: "block" }}>
                    <span>{r.title}</span>
                    {r.category_name && <span className="search-result-tag">{r.category_name}</span>}
                  </Link>
                ))}
              </div>
            )}
            {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="search-dropdown">
                <div className="search-result search-no-results">No recipes found</div>
              </div>
            )}
          </div>
          <button type="button" className="btn-secondary" onClick={() => setShowImport(true)}>Import</button>
          <button
            type="button"
            className="btn-primary topbar-new-recipe"
            onClick={() => setNewRecipeModalOpen(true)}
            aria-label="Add new recipe"
          >
            + New Recipe
          </button>
        </header>

        <main className="content">{children}</main>
        <NewRecipeModal
          open={newRecipeModalOpen}
          onClose={() => setNewRecipeModalOpen(false)}
        />
        {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      </div>
    </div>
  );
}
