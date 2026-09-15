/**
 * Shares deployment constants between Alchemy stacks.
 *
 * @module
 */
// oxlint-disable-next-line effect/avoid-node-imports -- Alchemy takes plain filesystem paths for build roots and migration directories; this resolves them from the module location before any Effect runtime exists.
import { fileURLToPath } from "node:url";

export const coffeeStackName = "effect-v4-onion";

const repoRoot = new URL("../../", import.meta.url);

/**
 * Resolves a repository-relative path to an absolute one. Alchemy resolves
 * relative paths against the process working directory, which is the
 * repository root for the `alchemy` CLI scripts but this workspace for
 * Turbo-run tests, so cross-workspace paths are anchored here instead.
 */
export const repoPath = (relativePath: string) => fileURLToPath(new URL(relativePath, repoRoot));

export const uiBuild = {
  command: "bun run build",
  include: ["index.html", "package.json", "public/**", "src/**", "tsconfig*.json", "vite.config.*"],
  lockfile: true,
  output: "dist",
} as const;
