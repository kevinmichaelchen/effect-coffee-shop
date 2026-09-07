import tailwindcss from "@tailwindcss/vite";
import type { UserConfig } from "vite";

const coffeeProxyTarget = process.env.VITE_COFFEE_PROXY_TARGET ?? "http://localhost:3000";

/**
 * Alchemy sets this marker whenever it hosts Vite (`alchemy dev`, deploys, and
 * the Alchemy Vitest harness). In that mode the Cloudflare Worker owns `/api`
 * and `/mcp` through worker-first asset routing, so proxying them to a
 * standalone backend would bypass the emulated Worker.
 */
const alchemyHostsVite = process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1";

const coffeeProxy = {
  "/api": {
    target: coffeeProxyTarget,
    changeOrigin: true,
    ws: true,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
  "/mcp": {
    target: coffeeProxyTarget,
    changeOrigin: true,
    ws: true,
  },
} satisfies NonNullable<NonNullable<UserConfig["server"]>["proxy"]>;

export const sharedViteConfig = {
  plugins: [tailwindcss()],
  server: {
    allowedHosts: [".localhost"],
    ...(alchemyHostsVite ? {} : { proxy: coffeeProxy }),
  },
} satisfies UserConfig;
