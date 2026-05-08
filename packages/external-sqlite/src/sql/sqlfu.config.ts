import { defineConfig } from "sqlfu";

export default defineConfig({
  definitions: "./definitions.sql",
  migrations: { path: "./migrations", preset: "d1" },
  queries: "./queries",
  generate: {
    runtime: "effect-v4-unstable",
  },
});
