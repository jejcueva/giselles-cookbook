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
  const emojiVariants: Record<string, string[]> = {
    hearts: ["\u2764\ufe0f", "\ud83d\udc95", "\ud83d\udc96", "\ud83e\ude77"],
    shamrocks: ["\u2618\ufe0f", "\ud83c\udf40", "\ud83c\udf3f"],
    pumpkins: ["\ud83c\udf83", "\ud83d\udd77\ufe0f", "\ud83e\udeb8", "\ud83c\udf19"],
    leaves: ["\ud83c\udf42", "\ud83c\udf41", "\ud83c\udf3e", "\ud83e\udeb9"],
    snowflakes: ["\u2744\ufe0f", "\u2746\ufe0f", "\ud83c\udf28\ufe0f", "\u2603\ufe0f"],
    sparkles: ["\u2728", "\ud83c\udf1f", "\ud83d\udcab", "\ud83c\udf86"],
  };
  const variants = emojiVariants[type] || ["\u2728"];
  return Array.from({ length: 10 }, (_, i) => ({
    emoji: variants[i % variants.length],
    x: 5 + i * 9 + Math.random() * 5,
    delay: i * 1.2 + Math.random() * 2,
    duration: 10 + Math.random() * 8,
    size: 0.7 + Math.random() * 0.8,
  }));
}
