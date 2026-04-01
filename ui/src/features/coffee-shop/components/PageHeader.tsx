import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Drawer } from "#shared/ui/retroui/Drawer.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { ThemeToggle } from "#shared/ui/ThemeToggle.tsx";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";
import { appRoutes } from "#app/routes.ts";

interface PageHeaderProps {
  activeOrders: number;
  theme: ThemePreference;
  totalOrders: number;
  onToggleTheme: () => void;
}

interface NavigationProps {
  theme: ThemePreference;
  totalOrders: number;
  activeOrders: number;
  onToggleTheme: () => void;
}

function HeaderIntro() {
  return (
    <div className="min-w-0 flex-1 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-none bg-primary px-2.5 py-1" size="sm" variant="surface">
          Control Room
        </Badge>
        <Text as="p" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          Customer + barista on one surface
        </Text>
      </div>
      <Text as="h1" className="max-w-3xl text-2xl leading-none md:text-3xl">
        Coffee Shop Control Room
      </Text>
      <Text as="p" className="max-w-2xl text-sm text-muted-foreground">
        Order drinks, inspect tickets, and move the queue without leaving the existing API flow.
      </Text>
    </div>
  );
}

function NavigationLink(inputProps: { href: string; variant: "default" | "ghost" | "outline"; children: ReactNode }) {
  const { href, variant, children } = inputProps;

  return (
    <Button asChild size="sm" variant={variant}>
      <a href={href}>{children}</a>
    </Button>
  );
}

function DesktopNavigation({ theme, onToggleTheme }: Pick<NavigationProps, "theme" | "onToggleTheme">) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <NavigationLink href={appRoutes.controlRoom} variant="ghost">
        Control Room
      </NavigationLink>
      <NavigationLink href={appRoutes.home} variant="outline">
        LFM Demo
      </NavigationLink>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </div>
  );
}

function SessionSummary({ activeOrders, totalOrders }: Pick<NavigationProps, "activeOrders" | "totalOrders">) {
  return (
    <div className="grid gap-2 border-2 border-border bg-background p-3">
      <Text as="p" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
        Session status
      </Text>
      <Text as="p" className="text-sm">
        {activeOrders} active tickets, {totalOrders} total orders in this session.
      </Text>
    </div>
  );
}

function MobileNavigation(inputProps: NavigationProps) {
  const { activeOrders, theme, totalOrders, onToggleTheme } = inputProps;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Drawer direction="right" open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <Drawer.Trigger asChild>
        <Button aria-label="Open navigation menu" className="md:hidden" size="icon" variant="outline">
          <Menu className="size-4" />
        </Button>
      </Drawer.Trigger>
      {isMenuOpen ? (
        <Drawer.Content className="border-l-2 border-border bg-card">
          <Drawer.Header className="border-b-2 border-border bg-card px-4 py-4 text-left">
            <Drawer.Title>Control room menu</Drawer.Title>
            <Drawer.Description>Navigate the control-room UI and switch themes without leaving the queue.</Drawer.Description>
          </Drawer.Header>
          <div className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Button asChild className="justify-center" variant="default">
                <a href={appRoutes.controlRoom}>Control Room</a>
              </Button>
              <Button asChild className="justify-center" variant="outline">
                <a href={appRoutes.home}>Back to LFM Demo</a>
              </Button>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <SessionSummary activeOrders={activeOrders} totalOrders={totalOrders} />
          </div>
        </Drawer.Content>
      ) : null}
    </Drawer>
  );
}

export function PageHeader(inputProps: PageHeaderProps) {
  const { activeOrders, theme, totalOrders, onToggleTheme } = inputProps;

  return (
    <header className="border-2 border-border bg-card shadow-md">
      <div className="flex items-start justify-between gap-3 px-4 py-4 md:px-5">
        <HeaderIntro />
        <DesktopNavigation theme={theme} onToggleTheme={onToggleTheme} />
        <MobileNavigation
          activeOrders={activeOrders}
          theme={theme}
          totalOrders={totalOrders}
          onToggleTheme={onToggleTheme}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border px-4 py-3 md:px-5">
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <Badge className="rounded-none px-2.5 py-1" size="sm" variant="outline">
            Existing HTTP API
          </Badge>
          <Badge className="rounded-none px-2.5 py-1" size="sm" variant="outline">
            Neo-brutalist shell
          </Badge>
        </div>
        <Text as="p" className="text-sm text-muted-foreground">
          {activeOrders} active tickets, {totalOrders} total orders in this session.
        </Text>
      </div>
    </header>
  );
}
