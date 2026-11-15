import { configDefaults, defineConfig } from "vitest/config";

// Vendored rule tests run through oxlint-plugin-anti-slop.test.ts.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "vendor/**"] },
});
