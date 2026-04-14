import { useEffect, type PropsWithChildren } from "react";
import { RouterContextProvider } from "@tanstack/react-router";
import { AppProviders } from "#app/AppProviders.tsx";
import { router } from "#app/router.tsx";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";

interface StorybookShellProps extends PropsWithChildren {
  theme: ThemePreference;
}

export function StorybookShell({ children, theme }: StorybookShellProps) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <AppProviders>
      <RouterContextProvider router={router}>
        <div className="min-h-screen bg-background p-4 text-foreground md:p-6">{children}</div>
      </RouterContextProvider>
    </AppProviders>
  );
}
