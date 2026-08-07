import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "#shared/ui/retroui/Button.tsx";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";

interface ThemeToggleProps {
  compact?: boolean;
  theme: ThemePreference;
  onToggle: () => void;
}

export function ThemeToggle({ compact = false, theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === "dark";
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- oxlint cannot resolve Lucide component types
  const Icon = isDark ? SunMedium : MoonStar;
  const label = isDark ? "Switch to light" : "Switch to dark";

  if (compact) {
    return (
      <Button aria-label={label} size="icon" title={label} variant="outline" onClick={onToggle}>
        <Icon className="size-4" />
        <span className="sr-only">{label}</span>
      </Button>
    );
  }

  return (
    <Button size="md" variant="outline" onClick={onToggle}>
      <Icon className="mr-2 size-4" />
      {label}
    </Button>
  );
}
