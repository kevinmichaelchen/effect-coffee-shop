import { appRoutes } from "#app/routes.ts";
import type { NavigationLinkProps } from "#features/coffee-shop/components/PageHeader.tsx";

export function getCoffeeHeaderLinks(target: "shop" | "staff"): readonly NavigationLinkProps[] {
  const workspaceLink =
    target === "staff"
      ? { href: appRoutes.staff, label: "Staff queue", variant: "outline" as const }
      : { href: appRoutes.shop, label: "Customer workspace", variant: "outline" as const };

  return [workspaceLink];
}
