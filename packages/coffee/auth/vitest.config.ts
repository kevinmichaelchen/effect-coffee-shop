import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each file starts a Cloudflare D1 runtime; avoid competing cold starts.
    fileParallelism: false,
  },
});
