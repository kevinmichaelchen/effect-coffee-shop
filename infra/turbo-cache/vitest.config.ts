import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      ALCHEMY_LOCAL_STATE: "true",
      ALCHEMY_TELEMETRY_DISABLED: "1",
      CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
      CLOUDFLARE_API_TOKEN: "local-emulation-only",
      CACHE_TEAM: "cache-test",
      CACHE_WRITE_TOKEN: "test-write-token-not-a-real-secret-0001",
      CACHE_READ_TOKEN: "test-read-token-not-a-real-secret-00002",
    },
    environment: "node",
    include: ["infra/turbo-cache/cloudflare.test.ts"],
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
