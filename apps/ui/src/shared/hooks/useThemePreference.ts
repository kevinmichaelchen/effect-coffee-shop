import { useState } from "react";

export type ThemePreference = "light" | "dark";

const storageKey = "coffee-shop-theme";

function readStoredTheme(): ThemePreference {
  return window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemePreference): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(storageKey, theme);
}

function readInitialTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "light";
  }

  const theme = readStoredTheme();
  applyTheme(theme);
  return theme;
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(readInitialTheme);

  function toggleTheme(): void {
    const nextTheme = theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return { theme, toggleTheme };
}
