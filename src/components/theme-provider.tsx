"use client";

import { useEffect } from "react";
import { getStoredColor, applyColor, applyDarkMode } from "@/lib/themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyDarkMode();
    applyColor(getStoredColor());
  }, []);

  return <>{children}</>;
}
