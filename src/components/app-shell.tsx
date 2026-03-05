"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppShellProps = {
  children: React.ReactNode;
};

const SESSION_KEY = "cute-cookbook-authenticated";

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
  const [searchResults, setSearchResults] = useState<{ id: string; title: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isAuthenticated] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(SESSION_KEY) === "true";
  });

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("recipes")
        .select("id, title")
        .ilike("title", `%${searchQuery}%`)
        .limit(8);

      if (data) {
        setSearchResults(data);
        setSearchOpen(true);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
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
                  <div key={r.id} className="search-result">
                    {r.title}
                  </div>
                ))}
              </div>
            )}
            {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="search-dropdown">
                <div className="search-result search-no-results">No recipes found</div>
              </div>
            )}
          </div>
          <button type="button">+ New Recipe</button>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
