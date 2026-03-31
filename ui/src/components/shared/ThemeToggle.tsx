import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "#components/retroui/Button";
import type { ThemePreference } from "#hooks/useThemePreference";

interface ThemeToggleProps {
  theme: ThemePreference;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === "dark";
  const Icon = isDark ? SunMedium : MoonStar;
  const label = isDark ? "Switch to light" : "Switch to dark";

  return (
    <Button variant="outline" onClick={onToggle}>
      <Icon className="mr-2 size-4" />
      {label}
    </Button>
  );
}
