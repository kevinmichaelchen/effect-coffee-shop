import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark";

const storageKey = "coffee-shop-theme";

function readStoredTheme(): ThemePreference {
  return window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemePreference): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(storageKey, theme);
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return readStoredTheme();
  });

  useEffect(() => applyTheme(theme), [theme]);

  function toggleTheme(): void {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }

  return { theme, toggleTheme };
}
