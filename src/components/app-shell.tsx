"use client";

import { NewRecipeModal } from "@/components/new-recipe-modal";
import { OutlineIcon, type NavIconName } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useViewer } from "@/components/viewer-provider";

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

type NavItem = {
  href: string;
  label: string;
  icon?: NavIconName;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/recipes", label: "Recipes", icon: "book" },
  { href: "/categories", label: "Categories", icon: "tag" },
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

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { canWrite, isRecruiter } = useViewer();
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
                  <Link key={r.id} href={`/recipes/${r.id}`} className="search-result">
                    <span className="search-result-title">{r.title}</span>
                    {r.category_name ? (
                      <>
                        <span className="search-result-sep" aria-hidden>
                          ·
                        </span>
                        <span className="search-result-tag">{r.category_name}</span>
                      </>
                    ) : null}
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

          {canWrite ? (
            <button
              type="button"
              className="btn-primary topbar-new-recipe"
              onClick={() => setNewRecipeModalOpen(true)}
              aria-label="Add new recipe"
            >
              <span className="new-recipe-plus">+</span>
              <span className="new-recipe-label">&nbsp;Recipe</span>
            </button>
          ) : null}
        </header>

        {isRecruiter ? (
          <p className="recruiter-banner">Recruiter preview. You can browse the cookbook, and edits stay turned off.</p>
        ) : null}

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
                        onClick={closeMobileSearch}
                      >
                        <span className="search-result-title">{r.title}</span>
                        {r.category_name ? (
                          <>
                            <span className="search-result-sep" aria-hidden>
                              ·
                            </span>
                            <span className="search-result-tag">{r.category_name}</span>
                          </>
                        ) : null}
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
