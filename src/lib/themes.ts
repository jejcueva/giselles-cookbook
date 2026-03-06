export type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  surface: string;
  border: string;
};

export type Theme = {
  id: string;
  name: string;
  colors: ThemeColors;
  decoration: "none" | "hearts" | "shamrocks" | "pumpkins" | "leaves" | "snowflakes" | "sparkles";
};

export const THEMES: Theme[] = [
  {
    id: "cottagecore",
    name: "Cottagecore",
    colors: {
      primary: "#f2b8c6",
      secondary: "#a67b5b",
      accent: "#a8bfa0",
      background: "#fff8f0",
      text: "#4a3728",
      surface: "#fffdfb",
      border: "#ebd8c8",
    },
    decoration: "none",
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    colors: {
      primary: "#e8355a",
      secondary: "#8b2252",
      accent: "#ffb6c1",
      background: "#fff0f3",
      text: "#4a1525",
      surface: "#fffbfc",
      border: "#f5c6d0",
    },
    decoration: "hearts",
  },
  {
    id: "stpatricks",
    name: "St. Patrick's Day",
    colors: {
      primary: "#2e8b57",
      secondary: "#daa520",
      accent: "#98fb98",
      background: "#f0fff0",
      text: "#1a3a2a",
      surface: "#f8fffa",
      border: "#b8dcc8",
    },
    decoration: "shamrocks",
  },
  {
    id: "halloween",
    name: "Halloween",
    colors: {
      primary: "#ff6b1a",
      secondary: "#9b59b6",
      accent: "#8b008b",
      background: "#1a1a2e",
      text: "#f0e6d3",
      surface: "#252540",
      border: "#3a3a5c",
    },
    decoration: "pumpkins",
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    colors: {
      primary: "#cc5500",
      secondary: "#8b4513",
      accent: "#daa520",
      background: "#fff8dc",
      text: "#3a2510",
      surface: "#fffdf5",
      border: "#e0c8a0",
    },
    decoration: "leaves",
  },
  {
    id: "christmas",
    name: "Christmas",
    colors: {
      primary: "#c41e3a",
      secondary: "#006400",
      accent: "#ffd700",
      background: "#fff8f0",
      text: "#2a1a1a",
      surface: "#fffdfb",
      border: "#e0c8c8",
    },
    decoration: "snowflakes",
  },
  {
    id: "newyears",
    name: "New Year's",
    colors: {
      primary: "#ffd700",
      secondary: "#c0c0c0",
      accent: "#ffd700",
      background: "#0d0d1a",
      text: "#e8e8f0",
      surface: "#1a1a2e",
      border: "#3a3a5c",
    },
    decoration: "sparkles",
  },
];

export const CUSTOM_COLORS = [
  { name: "Pink", hex: "#f2b8c6" },
  { name: "Rose", hex: "#e8355a" },
  { name: "Coral", hex: "#ff7f7f" },
  { name: "Brown", hex: "#a67b5b" },
  { name: "Sage", hex: "#a8bfa0" },
  { name: "Forest", hex: "#2e8b57" },
  { name: "Lavender", hex: "#b8a9d4" },
  { name: "Blue", hex: "#6b9fd4" },
  { name: "Gold", hex: "#daa520" },
];

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", theme.colors.primary);
  root.style.setProperty("--color-secondary", theme.colors.secondary);
  root.style.setProperty("--color-accent", theme.colors.accent);
  root.style.setProperty("--color-background", theme.colors.background);
  root.style.setProperty("--color-text", theme.colors.text);
  root.style.setProperty("--color-surface", theme.colors.surface);
  root.style.setProperty("--color-border", theme.colors.border);
}

export function applyCustomColor(hex: string) {
  document.documentElement.style.setProperty("--color-primary", hex);
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return THEMES[0];
  const id = localStorage.getItem("cookbook-theme") || "cottagecore";
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function getStoredCustomColor(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cookbook-custom-color");
}
