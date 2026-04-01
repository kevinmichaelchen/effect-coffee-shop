import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vite";
import { sharedViteConfig } from "./vite.shared.ts";

export default defineConfig(
  mergeConfig(sharedViteConfig, {
    plugins: [react()],
  }),
);
