import tailwindcss from "@tailwindcss/vite";
import type { UserConfig } from "vite";

const coffeeProxyTarget = process.env.VITE_COFFEE_PROXY_TARGET ?? "http://localhost:3000";

export const sharedViteConfig = {
  plugins: [tailwindcss()],
  server: {
    allowedHosts: [".localhost"],
    proxy: {
      "/api": {
        target: coffeeProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/mcp": {
        target: coffeeProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
} satisfies UserConfig;
