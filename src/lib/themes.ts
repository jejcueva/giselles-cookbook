// the 7 accent colors users can pick from
export const UI_COLORS = [
  { name: "Pink", hex: "#f2b8c6" },
  { name: "Blue", hex: "#6b9fd4" },
  { name: "Green", hex: "#6dba7a" },
  { name: "Brown", hex: "#a67b5b" },
  { name: "Red", hex: "#d45b5b" },
  { name: "Black", hex: "#4a4a4a" },
  { name: "Purple", hex: "#9b7fc4" },
];

const DEFAULT_COLOR = "#f2b8c6";

// parses hex to [r, g, b]
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// darken a hex color by a percentage (0-1)
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (v: number) => Math.round(v * (1 - amount));
  return `#${d(r).toString(16).padStart(2, "0")}${d(g).toString(16).padStart(2, "0")}${d(b).toString(16).padStart(2, "0")}`;
}

// lighten toward white by a percentage (0-1)
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const l = (v: number) => Math.round(v + (255 - v) * amount);
  return `#${l(r).toString(16).padStart(2, "0")}${l(g).toString(16).padStart(2, "0")}${l(b).toString(16).padStart(2, "0")}`;
}

// relative luminance (0 = black, 1 = white)
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// picks a nice text color to sit on top of the primary color
function textOnColor(hex: string): string {
  const normalized = hex.toLowerCase();

  // force white text for the original pink so it pops more
  if (normalized === "#f2b8c6") {
    return "#fff";
  }

  return luminance(hex) > 0.4 ? "#3a2a1a" : "#fff";
}

// sets all the primary-color css variables from a single hex
export function applyColor(hex: string) {
  const root = document.documentElement;
  const [r, g, b] = hexToRgb(hex);
  root.style.setProperty("--color-primary", hex);
  root.style.setProperty("--color-primary-deep", darken(hex, 0.15));
  root.style.setProperty("--color-primary-light", lighten(hex, 0.88));
  root.style.setProperty("--color-primary-soft", lighten(hex, 0.78));
  root.style.setProperty("--color-primary-shadow", `${r}, ${g}, ${b}`);
  root.style.setProperty("--color-on-primary", textOnColor(hex));
}

export function getStoredColor(): string {
  if (typeof window === "undefined") return DEFAULT_COLOR;
  return localStorage.getItem("cookbook-color") || DEFAULT_COLOR;
}

export function storeColor(hex: string) {
  localStorage.setItem("cookbook-color", hex);
}

export function isDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("cookbook-dark") === "true";
}

export function setDarkMode(on: boolean) {
  localStorage.setItem("cookbook-dark", String(on));
  document.documentElement.setAttribute("data-theme", on ? "dark" : "light");
}

export function applyDarkMode() {
  const dark = isDarkMode();
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}
