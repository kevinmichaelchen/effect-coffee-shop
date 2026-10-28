import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig, mergeConfig } from "vite";
import { sharedViteConfig } from "./vite.shared.ts";

export default defineConfig(mergeConfig(sharedViteConfig, { plugins: [foldkit()] }));
