import { defineConfig } from "vitest/config";

/**
 * The Cloudflare stack is exercised entirely through Alchemy's local
 * emulation (`dev: true` + `localState()`), so no real Cloudflare account is
 * ever contacted. Alchemy still resolves an account ID and token before it
 * builds any provider, even the local ones, and it reads them from the
 * caller's Alchemy profile. Pinning placeholder values here keeps the run
 * deterministic and provably offline regardless of which profile or shell
 * environment the developer has configured.
 */
const localOnlyCloudflareEnv = {
  ALCHEMY_LOCAL_STATE: "1",
  ALCHEMY_TELEMETRY_DISABLED: "1",
  CLOUDFLARE_ACCOUNT_ID: "0".repeat(32),
  CLOUDFLARE_API_TOKEN: "local-emulation-only",
};

export default defineConfig({
  test: {
    env: localOnlyCloudflareEnv,
    environment: "node",
    include: ["infra/alchemy/cloudflare.test.ts"],
    testTimeout: 300_000,
  },
});
