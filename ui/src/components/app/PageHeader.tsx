import { Badge } from "#components/retroui/Badge";
import { Button } from "#components/retroui/Button";
import { Text } from "#components/retroui/Text";
import { ThemeToggle } from "#components/shared/ThemeToggle";
import type { ThemePreference } from "#hooks/useThemePreference";
import { appRoutes } from "#lib/routes";

interface PageHeaderProps {
  activeOrders: number;
  theme: ThemePreference;
  totalOrders: number;
  onToggleTheme: () => void;
}

export function PageHeader(inputProps: PageHeaderProps) {
  const { activeOrders, theme, totalOrders, onToggleTheme } = inputProps;

  return (
    <header className="grid gap-4 border-2 border-border bg-card px-4 py-5 shadow-md lg:grid-cols-[1fr_auto] lg:px-6">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-none bg-primary px-2.5 py-1" size="sm" variant="surface">
            Customer + Barista
          </Badge>
          <Badge className="rounded-none px-2.5 py-1" size="sm" variant="outline">
            Existing HTTP API
          </Badge>
        </div>
        <Text as="h1" className="max-w-3xl text-4xl leading-none md:text-6xl">
          Coffee Shop Control Room
        </Text>
        <Text as="p" className="max-w-2xl text-base text-muted-foreground md:text-lg">
          A single brutalist surface for ordering drinks and running the queue without touching the
          backend boundaries.
        </Text>
      </div>
      <div className="flex flex-col items-start gap-3 lg:items-end">
        <Button asChild variant="outline">
          <a href={appRoutes.home}>Back to LFM demo</a>
        </Button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <Text as="p" className="text-sm text-muted-foreground">
          {activeOrders} active tickets, {totalOrders} total orders in this session.
        </Text>
      </div>
    </header>
  );
}
