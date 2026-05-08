export const appRoutes = {
  agentCapabilities: "/device/capabilities",
  home: "/",
  shop: "/shop",
  staff: "/staff",
} as const;

const shopAliases = new Set<string>(["/control-room", "/coffee-shop"]);

export function isShopPath(pathname: string): boolean {
  return pathname === appRoutes.shop || shopAliases.has(pathname);
}
