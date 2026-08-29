import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["infra/alchemy/cloudflare.test.ts"],
    testTimeout: 300_000,
  },
});
