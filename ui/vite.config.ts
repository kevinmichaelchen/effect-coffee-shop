import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const coffeeProxyTarget = process.env.VITE_COFFEE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
