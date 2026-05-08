import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Drawer } from "#shared/ui/retroui/Drawer.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { ThemeToggle } from "#shared/ui/ThemeToggle.tsx";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";

interface PageHeaderProps {
  activeOrders: number;
  badgeLabel: string;
  footerLabel: string;
  navLinks: readonly NavigationLinkProps[];
  theme: ThemePreference;
  title: string;
  totalOrders: number;
  onToggleTheme: () => void;
}

interface NavigationProps {
  theme: ThemePreference;
  totalOrders: number;
  activeOrders: number;
  navLinks: readonly NavigationLinkProps[];
  onToggleTheme: () => void;
}

export interface NavigationLinkProps {
  href: string;
  label: string;
  variant: "default" | "ghost" | "outline";
}

function HeaderIntro(inputProps: Pick<PageHeaderProps, "badgeLabel" | "title">) {
  const { badgeLabel, title } = inputProps;

  return (
    <div className="grid min-w-0 flex-1 gap-1">
      <Text as="p" className="text-xs font-medium text-muted-foreground">
        {badgeLabel}
      </Text>
      <Text as="h1" className="max-w-3xl text-2xl font-semibold leading-tight md:text-3xl">
        {title}
      </Text>
    </div>
  );
}

function NavigationLink(inputProps: NavigationLinkProps & { children?: ReactNode }) {
  const { children, href, label, variant } = inputProps;

  return (
    <Button asChild size="sm" variant={variant}>
      <a href={href}>{children ?? label}</a>
    </Button>
  );
}

function DesktopNavigation({
  navLinks,
  theme,
  onToggleTheme,
}: Pick<NavigationProps, "navLinks" | "theme" | "onToggleTheme">) {
  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex">
      {navLinks.map((link) => (
        <NavigationLink key={link.href} {...link} />
      ))}
      <ThemeToggle compact theme={theme} onToggle={onToggleTheme} />
    </div>
  );
}

function SessionSummary({
  activeOrders,
  totalOrders,
}: Pick<NavigationProps, "activeOrders" | "totalOrders">) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <Text as="p">
        <span className="font-semibold text-foreground">{activeOrders}</span> active
      </Text>
      <Text as="p">
        <span className="font-semibold text-foreground">{totalOrders}</span> total
      </Text>
    </div>
  );
}

function MobileNavigation(inputProps: NavigationProps) {
  const { activeOrders, navLinks, theme, totalOrders, onToggleTheme } = inputProps;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Drawer direction="right" open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <Drawer.Trigger asChild>
        <Button
          aria-label="Open navigation menu"
          className="md:hidden"
          size="icon"
          variant="outline"
        >
          <Menu className="size-4" />
        </Button>
      </Drawer.Trigger>
      {isMenuOpen ? (
        <Drawer.Content className="border-l border-border bg-card">
          <Drawer.Header className="border-b border-border bg-card px-4 py-4 text-left">
            <Drawer.Title>Workspace menu</Drawer.Title>
            <Drawer.Description>Navigation and theme controls.</Drawer.Description>
          </Drawer.Header>
          <div className="grid gap-4 p-4">
            <SessionSummary activeOrders={activeOrders} totalOrders={totalOrders} />
            <div className="grid gap-2">
              {navLinks.map((link) => (
                <Button key={link.href} asChild className="justify-center" variant={link.variant}>
                  <a href={link.href}>{link.label}</a>
                </Button>
              ))}
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </Drawer.Content>
      ) : null}
    </Drawer>
  );
}

export function PageHeader(inputProps: PageHeaderProps) {
  const {
    activeOrders,
    badgeLabel,
    footerLabel,
    navLinks,
    theme,
    title,
    totalOrders,
    onToggleTheme,
  } = inputProps;

  return (
    <header className="grid gap-4 border-b border-border pb-4">
      <div className="flex min-h-14 items-start justify-between gap-3">
        <HeaderIntro badgeLabel={badgeLabel} title={title} />
        <DesktopNavigation navLinks={navLinks} theme={theme} onToggleTheme={onToggleTheme} />
        <MobileNavigation
          activeOrders={activeOrders}
          navLinks={navLinks}
          theme={theme}
          totalOrders={totalOrders}
          onToggleTheme={onToggleTheme}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text as="p" className="text-sm text-muted-foreground">
          {footerLabel}
        </Text>
        <SessionSummary activeOrders={activeOrders} totalOrders={totalOrders} />
      </div>
    </header>
  );
}
