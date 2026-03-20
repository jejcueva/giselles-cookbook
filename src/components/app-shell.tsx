"use client";

import { NewRecipeModal } from "@/components/new-recipe-modal";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppShellProps = {
  children: React.ReactNode;
};

type SearchResult = {
  id: string;
  title: string;
  category_name: string | null;
};

type RecipeSearchQueryRow = {
  id: string;
  title: string;
  recipe_categories:
    | Array<{ categories: { name: string | null } | null } | null>
    | null;
};

type NavIconName = "home" | "book" | "heart" | "chat" | "settings" | "search";

type NavItem = {
  href: string;
  label: string;
  icon?: NavIconName;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/recipes", label: "Recipes", icon: "book" },
  { href: "/categories", label: "Categories", icon: "settings" },
  { href: "/favorites", label: "Favorites", icon: "heart" },
];

const UTILITY_ITEMS: NavItem[] = [
  { href: "/ai-assistant", label: "AI Assistant", icon: "chat" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const MOBILE_TAB_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/recipes", label: "Recipes", icon: "book" },
  { href: "/favorites", label: "Favorites", icon: "heart" },
  { href: "/ai-assistant", label: "Chat", icon: "chat" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function isPathActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function OutlineIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "home" && (
        <>
          <path d="M3.75 10.5 12 3.75l8.25 6.75" />
          <path d="M5.25 9.75v9a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5v-9" />
          <path d="M10.5 20.25V15a1.5 1.5 0 0 1 3 0v5.25" />
        </>
      )}
      {name === "book" && (
        <>
          <path d="M12 5.25c-1.9-1.45-4.76-1.95-8.25-1.5v15c3.49-.45 6.35.05 8.25 1.5" />
          <path d="M12 5.25c1.9-1.45 4.76-1.95 8.25-1.5v15c-3.49-.45-6.35.05-8.25 1.5" />
        </>
      )}
      {name === "heart" && (
        <path d="M12 20.25s-6.75-4.35-8.25-8.1c-1.11-2.78.18-5.9 3-6.9 1.84-.66 3.68-.1 5.25 1.65 1.57-1.75 3.41-2.31 5.25-1.65 2.82 1 4.11 4.12 3 6.9-1.5 3.75-8.25 8.1-8.25 8.1Z" />
      )}
      {name === "chat" && (
        <path d="M7.5 18.75 3.75 20.25l1.5-4.5A7.5 7.5 0 1 1 20.25 12a7.5 7.5 0 0 1-7.5 7.5H7.5Z" />
      )}
      {name === "settings" && (
        <>
          <path d="M4.5 6.75h6.75" />
          <path d="M15 6.75h4.5" />
          <circle cx="13.125" cy="6.75" r="1.875" />
          <path d="M4.5 12h3" />
          <path d="M11.25 12h8.25" />
          <circle cx="8.625" cy="12" r="1.875" />
          <path d="M4.5 17.25h9" />
          <path d="M17.25 17.25h2.25" />
          <circle cx="15.375" cy="17.25" r="1.875" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="10.5" cy="10.5" r="5.75" />
          <path d="m15.25 15.25 4 4" />
        </>
      )}
    </svg>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [newRecipeModalOpen, setNewRecipeModalOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchQuery.length < 2) {
      return;
    }

    let isActive = true;
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("recipes")
        .select("id, title, recipe_categories ( categories ( name ) )")
        .ilike("title", `%${searchQuery}%`)
        .limit(8);

      if (!isActive) return;

      const results = ((data as RecipeSearchQueryRow[] | null) ?? []).map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        category_name: recipe.recipe_categories?.[0]?.categories?.name ?? null,
      }));

      setSearchResults(results);
      setSearchOpen(true);
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!mobileSearchOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      mobileSearchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [mobileSearchOpen]);

  function handleSearchChange(nextQuery: string) {
    setSearchQuery(nextQuery);

    if (nextQuery.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
    }
  }

  function openMobileSearch() {
    setMobileSearchOpen(true);
    if (searchResults.length > 0 && searchQuery.length >= 2) {
      setSearchOpen(true);
    }
  }

  function closeMobileSearch() {
    setMobileSearchOpen(false);
    setSearchOpen(false);
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
              const isActive = isPathActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? "nav-link active" : "nav-link"}
                  title={collapsed ? item.label : undefined}
                >
                  {collapsed && item.icon ? (
                    <span className="mobile-tab-icon" aria-hidden="true">
                      <OutlineIcon name={item.icon} className="app-shell-icon" />
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}

            <hr className="nav-divider" />

            {UTILITY_ITEMS.map((item) => {
              const isActive = isPathActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? "nav-link active" : "nav-link"}
                  title={collapsed ? item.label : undefined}
                >
                  {collapsed && item.icon ? (
                    <span className="mobile-tab-icon" aria-hidden="true">
                      <OutlineIcon name={item.icon} className="app-shell-icon" />
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={async () => {
            const response = await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
            });
            if (!response.ok) {
              return;
            }
            localStorage.removeItem("cute-cookbook-username");
            localStorage.removeItem("cute-cookbook-birthday-entry");
            router.push("/login");
          }}
        >
          {collapsed ? "x" : "Log Out"}
        </button>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="mobile-search-trigger"
            onClick={openMobileSearch}
            aria-label="Search recipes"
            aria-haspopup="dialog"
            aria-expanded={mobileSearchOpen}
          >
            <OutlineIcon name="search" className="mobile-search-trigger-icon" />
          </button>

          <Link href="/" className="topbar-brand">
            <span className="topbar-brand-line">Jizzy&apos;s</span>
            <span className="topbar-brand-line">Cookbook</span>
          </Link>

          <div className="search-wrapper desktop-search">
            <input
              type="search"
              placeholder="Search recipes..."
              aria-label="Search recipes"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((r) => (
                  <Link
                    key={r.id}
                    href={`/recipes/${r.id}`}
                    className="search-result"
                    style={{ textDecoration: "none", display: "block" }}
                  >
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

          <button
            type="button"
            className="btn-primary topbar-new-recipe"
            onClick={() => setNewRecipeModalOpen(true)}
            aria-label="Add new recipe"
          >
            <span className="new-recipe-plus">+</span>
            <span className="new-recipe-label">&nbsp;Recipe</span>
          </button>
        </header>

        {mobileSearchOpen && (
          <div className="mobile-search-overlay" onClick={closeMobileSearch}>
            <div
              className="mobile-search-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Search recipes"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-search-panel-header">
                <h2 className="mobile-search-title">Search Recipes</h2>
                <button
                  type="button"
                  className="mobile-search-close"
                  onClick={closeMobileSearch}
                  aria-label="Close search"
                >
                  Cancel
                </button>
              </div>

              <div className="search-wrapper mobile-search-wrapper">
                <input
                  ref={mobileSearchInputRef}
                  type="search"
                  placeholder="Search recipes..."
                  aria-label="Search recipes"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                />
                {searchOpen && searchResults.length > 0 && (
                  <div className="search-dropdown">
                    {searchResults.map((r) => (
                      <Link
                        key={r.id}
                        href={`/recipes/${r.id}`}
                        className="search-result"
                        style={{ textDecoration: "none", display: "block" }}
                        onClick={closeMobileSearch}
                      >
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
            </div>
          </div>
        )}

        <main className="content">{children}</main>
        <NewRecipeModal
          open={newRecipeModalOpen}
          onClose={() => setNewRecipeModalOpen(false)}
        />
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-tab-bar" aria-label="Mobile navigation">
        {MOBILE_TAB_ITEMS.map((item) => {
          const isActive = isPathActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "mobile-tab active" : "mobile-tab"}
              aria-label={item.label}
            >
              {item.icon && (
                <span className="mobile-tab-icon">
                  <OutlineIcon name={item.icon} className="app-shell-icon" />
                </span>
              )}
              <span className="mobile-tab-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
