/**
 * Reports which dependency patches still earn their keep (see issue #128).
 * Run after upgrading any patched package: `bun run patches:check`.
 */
import { readdirSync, readFileSync } from "node:fs";
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

const neededBy: Record<string, () => string> = {
  "@alchemy.run/rivet": () =>
    "check by deleting the patch and running `bun run --cwd packages/coffee/server typecheck`: hosts/model/RivetDocker.ts passes a Docker.Swarm as the control plane's context",
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
