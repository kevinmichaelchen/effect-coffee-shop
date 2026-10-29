/**
 * Reports which dependency patches still earn their keep (see issue #128).
 * Run after upgrading any patched package: `bun run patches:check`.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const manifest: { readonly patchedDependencies: Record<string, string> } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);

const store = join(root, "node_modules/.bun");
const installed = (spec: string) =>
  readdirSync(store).some(
    (entry) => entry.startsWith(`${spec.replace("/", "+")}+`) || entry === spec.replace("/", "+"),
  );

const workspaces = ["apps", "packages", "packages/coffee", "packages/coffee/presentation", "infra"]
  .flatMap((dir) => readdirSync(join(root, dir)).map((name) => join(root, dir, name)))
  .filter((dir) => existsSync(join(dir, "node_modules")));

/** Files of the packages workspaces really resolve, not stale store entries. */
const resolvedFiles = (scope: string): string[] => {
  const packages = new Set(
    workspaces.flatMap((dir) => {
      const scoped = join(dir, "node_modules", scope);
      return existsSync(scoped)
        ? readdirSync(scoped).map((name) => realpathSync(join(scoped, name)))
        : [];
    }),
  );
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.(m?js)$/.test(name) ? [path] : [];
    });
  return [...packages].flatMap((dir) =>
    existsSync(join(dir, "dist")) ? walk(join(dir, "dist")) : [],
  );
};

/** Still needed while anything we install imports the module the patch restores. */
const importsLegacyCrypto = () =>
  [...resolvedFiles("@yielded"), ...resolvedFiles("@foldkit")].filter((file) => {
    const source = readFileSync(file, "utf8");
    return (
      source.includes('"effect/Crypto"') || /\bCrypto\b[^;]*from\s*["']effect["']/.test(source)
    );
  });

const neededBy: Record<string, () => string> = {
  effect: () => {
    const files = importsLegacyCrypto();
    return files.length === 0
      ? "NO LONGER NEEDED: nothing imports effect/Crypto. Delete the patch."
      : `still needed: ${files.length} files import effect/Crypto (e.g. ${files[0]?.split("node_modules/").at(-1)})`;
  },
  "@yielded/auth-persistence": () =>
    "check by deleting the patch and running `bun run --cwd packages/coffee/auth test`: passkey registration answers 503 while the bug remains",
};

for (const [spec, file] of Object.entries(manifest.patchedDependencies)) {
  const name = spec.slice(0, spec.lastIndexOf("@"));
  const status = installed(spec)
    ? (neededBy[name]?.() ?? "no check defined")
    : "UNUSED: this version is no longer installed. Re-check, then delete or re-target the patch.";
  console.log(`${spec}\n  ${file}\n  ${status}\n`);
}
