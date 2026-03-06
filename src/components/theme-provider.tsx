"use client";

import { useEffect, useState } from "react";
import { getStoredTheme, getStoredCustomColor, applyTheme, applyCustomColor } from "@/lib/themes";

function getInitialDecoration(): string {
  if (typeof window === "undefined") {
    return "none";
  }

  const theme = getStoredTheme();
  const customColor = getStoredCustomColor();
  return customColor ? "none" : theme.decoration;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [decoration] = useState<string>(getInitialDecoration);

  useEffect(() => {
    const theme = getStoredTheme();
    applyTheme(theme);

    const customColor = getStoredCustomColor();
    if (customColor) {
      applyCustomColor(customColor);
    }
  }, []);

  return (
    <>
      {children}
      {decoration !== "none" && <DecorationOverlay type={decoration} />}
    </>
  );
}

function DecorationOverlay({ type }: { type: string }) {
  const items = getDecorationItems(type);
  return (
    <div className="decoration-overlay">
      {items.map((item, i) => (
        <span
          key={i}
          className="decoration-item"
          style={{
            left: `${item.x}%`,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
            fontSize: `${item.size}rem`,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}

type DecoItem = { emoji: string; x: number; delay: number; duration: number; size: number };

function getDecorationItems(type: string): DecoItem[] {
  const emojiMap: Record<string, string> = {
    hearts: "\u2764\ufe0f",
    shamrocks: "\u2618\ufe0f",
    pumpkins: "\ud83c\udf83",
    leaves: "\ud83c\udf42",
    snowflakes: "\u2744\ufe0f",
    sparkles: "\u2728",
  };
  const emoji = emojiMap[type] || "\u2728";
  return Array.from({ length: 6 }, (_, i) => ({
    emoji,
    x: 10 + i * 15 + Math.random() * 10,
    delay: i * 1.5,
    duration: 8 + Math.random() * 4,
    size: 0.8 + Math.random() * 0.6,
  }));
}
