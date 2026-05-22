export const coffeeStackName = "effect-v4-onion";

export const uiBuild = {
  command: "bun run build",
  include: ["index.html", "package.json", "public/**", "src/**", "tsconfig*.json", "vite.config.*"],
  lockfile: true,
  output: "dist",
} as const;
