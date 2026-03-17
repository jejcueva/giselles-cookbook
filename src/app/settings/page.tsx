"use client";

import { AppShell } from "@/components/app-shell";
import { UI_COLORS, applyColor, storeColor, isDarkMode, setDarkMode } from "@/lib/themes";
import { useState } from "react";

export default function SettingsPage() {
  const feedbackHref =
    "mailto:heyseuc@gmail.com" +
    `?subject=${encodeURIComponent("Cute Cookbook — feedback / feature request / issue")}` +
    `&body=${encodeURIComponent(
      [
        "Hi!",
        "",
        "I have some feedback / a feature request / an issue:",
        "",
        "- What I was trying to do:",
        "- What happened instead:",
        "- What I expected:",
        "- Steps to reproduce (if relevant):",
        "",
        "Thanks!",
      ].join("\n")
    )}`;
  const [activeColor, setActiveColor] = useState(() => {
    if (typeof window === "undefined") return "#f2b8c6";
    return localStorage.getItem("cookbook-color") || "#f2b8c6";
  });
  const [darkMode, setDarkModeState] = useState(() => isDarkMode());

  function selectColor(hex: string) {
    storeColor(hex);
    setActiveColor(hex);
    applyColor(hex);
  }

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkModeState(next);
    setDarkMode(next);
  }

  return (
    <AppShell>
      <section className="settings-page">
        <h1 className="section-title">Settings</h1>

        <div className="settings-section">
          <h2 className="settings-heading">Dark Mode</h2>
          <div className="dark-mode-toggle-row">
            <button
              type="button"
              className={`dark-mode-toggle${darkMode ? " dark-mode-on" : ""}`}
              onClick={toggleDarkMode}
              aria-pressed={darkMode}
            >
              <span className="dark-mode-toggle-thumb" />
            </button>
            <span className="dark-mode-label">{darkMode ? "On" : "Off"}</span>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-heading">UI Color</h2>
          <p className="settings-description">Pick an accent color for buttons, links, and highlights.</p>
          <div className="color-picker-row">
            {UI_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`color-swatch-btn${activeColor === c.hex ? " color-swatch-active" : ""}`}
                style={{ background: c.hex }}
                onClick={() => selectColor(c.hex)}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-heading">Feedback / Complaint</h2>
          <p className="settings-description">
            Send any feedback, suggested features, or issues you&apos;re having.
          </p>
          <a className="btn-primary" href={feedbackHref}>
            Email feedback
          </a>
        </div>
      </section>
    </AppShell>
  );
}
