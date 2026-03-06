"use client";

import { AppShell } from "@/components/app-shell";
import { THEMES, CUSTOM_COLORS, applyTheme, applyCustomColor, type Theme } from "@/lib/themes";
import { useState } from "react";

export default function SettingsPage() {
  const [activeTheme, setActiveTheme] = useState(() => {
    if (typeof window === "undefined") return "cottagecore";
    return localStorage.getItem("cookbook-theme") || "cottagecore";
  });
  const [activeColor, setActiveColor] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("cookbook-custom-color");
  });

  function selectTheme(theme: Theme) {
    localStorage.setItem("cookbook-theme", theme.id);
    localStorage.removeItem("cookbook-custom-color");
    setActiveTheme(theme.id);
    setActiveColor(null);
    applyTheme(theme);
    window.location.reload();
  }

  function selectColor(hex: string) {
    localStorage.setItem("cookbook-custom-color", hex);
    setActiveColor(hex);
    applyCustomColor(hex);
  }

  function clearCustomColor() {
    localStorage.removeItem("cookbook-custom-color");
    setActiveColor(null);
    const theme = THEMES.find((t) => t.id === activeTheme) || THEMES[0];
    applyTheme(theme);
  }

  return (
    <AppShell>
      <section className="settings-page">
        <h1 className="section-title">Settings</h1>

        <div className="settings-section">
          <h2 className="settings-heading">Holiday Themes</h2>
          <div className="theme-grid">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`theme-card${activeTheme === theme.id && !activeColor ? " theme-card-active" : ""}`}
                onClick={() => selectTheme(theme)}
              >
                <div className="theme-swatches">
                  <span className="theme-swatch" style={{ background: theme.colors.primary }} />
                  <span className="theme-swatch" style={{ background: theme.colors.secondary }} />
                  <span className="theme-swatch" style={{ background: theme.colors.accent }} />
                  <span className="theme-swatch" style={{ background: theme.colors.background }} />
                </div>
                <span className="theme-name">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-heading">Custom Color</h2>
          <p className="settings-description">Override just the primary color without changing the full theme.</p>
          <div className="color-picker-row">
            {CUSTOM_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`color-swatch-btn${activeColor === c.hex ? " color-swatch-active" : ""}`}
                style={{ background: c.hex }}
                onClick={() => selectColor(c.hex)}
                title={c.name}
              />
            ))}
            {activeColor && (
              <button type="button" className="btn-secondary" onClick={clearCustomColor}>
                Reset
              </button>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
