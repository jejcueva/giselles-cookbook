"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(SESSION_KEY) === "true";
  });

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
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Cute Cookbook</p>
          <h2>Jizzy&apos;s Kitchen</h2>
        </div>

        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "nav-link active" : "nav-link"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={() => {
            localStorage.removeItem(SESSION_KEY);
            router.push("/login");
          }}
        >
          Log Out
        </button>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <input type="search" placeholder="Search recipes" aria-label="Search recipes" />
          <button type="button">+ New Recipe</button>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
