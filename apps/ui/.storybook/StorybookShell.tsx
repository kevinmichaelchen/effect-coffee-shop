import type { PropsWithChildren } from "react";
import { AppProviders } from "#app/AppProviders.tsx";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";

interface StorybookShellProps extends PropsWithChildren {
  theme: ThemePreference;
}

export function StorybookShell({ children, theme }: StorybookShellProps) {
  document.documentElement.classList.toggle("dark", theme === "dark");

  return (
    <AppProviders>
      <div className="min-h-screen bg-background p-4 text-foreground md:p-6">{children}</div>
    </AppProviders>
  );
}
