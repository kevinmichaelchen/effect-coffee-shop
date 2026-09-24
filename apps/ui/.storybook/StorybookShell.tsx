import type { PropsWithChildren } from "react";
import { AppProviders } from "#app/AppProviders.tsx";
import type { ThemePreference } from "@effect-coffee-shop/ui-kit/hooks/useThemePreference";

export interface StorybookShellProps extends PropsWithChildren {
  theme: ThemePreference;
}

export function StorybookShell({ children, theme }: StorybookShellProps) {
  return (
    <AppProviders>
      <div
        ref={(element) => {
          if (element === null) return;
          const root = element.ownerDocument.documentElement;
          const wasDark = root.classList.contains("dark");
          root.classList.toggle("dark", theme === "dark");
          return () => {
            root.classList.toggle("dark", wasDark);
          };
        }}
        className="min-h-screen bg-background p-4 text-foreground md:p-6"
      >
        {children}
      </div>
    </AppProviders>
  );
}
