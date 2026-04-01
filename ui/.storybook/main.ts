import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import { sharedViteConfig } from "../vite.shared.ts";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    defaultName: "Docs",
  },
  async viteFinal(config) {
    return mergeConfig(config, sharedViteConfig);
  },
};

export default config;
