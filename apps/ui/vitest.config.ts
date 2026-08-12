import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import type { BrowserProviderOption } from "vitest/node";
import { defineConfig } from "vitest/config";

const dirname = import.meta.dirname;
const storybookBrowserProvider: BrowserProviderOption = playwright({});

export default defineConfig({
  test: {
    projects: (["light", "dark"] as const).map((theme) => ({
      extends: true as const,
      plugins: [
        storybookTest({
          configDir: path.join(dirname, ".storybook"),
          storybookScript: "bun run storybook",
          initialGlobals: { theme },
        }),
      ],
      test: {
        name: `storybook-${theme}`,
        browser: {
          enabled: true,
          headless: true,
          provider: storybookBrowserProvider,
          instances: [{ browser: "chromium" as const }],
        },
      },
    })),
  },
});
