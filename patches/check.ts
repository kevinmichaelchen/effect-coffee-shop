/**
 * Reports which dependency patches still earn their keep (see issue #128).
 * Run after upgrading any patched package: `bun run patches:check`.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const root = join(import.meta.dirname, "..");

interface Manifest {
  readonly workspaces: { readonly packages: ReadonlyArray<string> };
  readonly patchedDependencies: Record<string, string>;
}

const manifest: Manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const versionOf = (packageJson: string): string => {
  const installed: { readonly version: string } = JSON.parse(readFileSync(packageJson, "utf8"));
  return installed.version;
};

/** Bun installs per workspace under its isolated linker, so ask each one, then the root. */
const workspaces = [
  ".",
  ...manifest.workspaces.packages.flatMap((pattern) => [
    ...new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: false }),
  ]),
];

const whereInstalled = (name: string) =>
  workspaces
    .map((workspace) => {
      const dir = join(root, workspace, "node_modules", name);
      const packageJson = join(dir, "package.json");
      return existsSync(packageJson)
        ? {
            workspace: workspace === "." ? "root" : workspace,
            dir,
            version: versionOf(packageJson),
          }
        : undefined;
    })
    .find((hit) => hit !== undefined);

/** The files a patch writes, taken from its `+++ b/<path>` headers. */
const patchedFiles = (patch: string): ReadonlyArray<string> =>
  readFileSync(patch, "utf8")
    .split("\n")
    .flatMap((line) => (line.startsWith("+++ b/") ? [line.slice("+++ b/".length).trim()] : []));

/**
 * Whether the patch is already in the installed copy (reverse) and whether it
 * would still apply to it (forward). `git apply` silently skips files that
 * match the repo's ignore rules, so check a copy outside the repo.
 */
const patchChecks = (dir: string, patch: string) => {
  const scratch = mkdtempSync(join(tmpdir(), "patches-check-"));
  for (const file of patchedFiles(patch)) {
    const source = join(dir, file);
    if (!existsSync(source)) continue;
    mkdirSync(dirname(join(scratch, file)), { recursive: true });
    copyFileSync(source, join(scratch, file));
  }
  const check = (flags: ReadonlyArray<string>) =>
    spawnSync("git", ["apply", "--check", ...flags, patch], { cwd: scratch }).status === 0;
  const checks = { applied: check(["--reverse"]), applies: check([]) };
  rmSync(scratch, { recursive: true, force: true });
  return checks;
};

const status = (name: string, spec: string, file: string): string => {
  const installed = whereInstalled(name);
  if (installed === undefined) return "not installed in any workspace: UNUSED. Delete the patch.";
  const patched = spec.slice(spec.lastIndexOf("@") + 1);
  const where = `${installed.version} (${installed.workspace})`;
  const checks = patchChecks(installed.dir, join(root, file));
  if (installed.version === patched) {
    return checks.applied
      ? `in use ${where}: applied`
      : `in use ${where}: NOT applied even though the versions match. Rerun bun install, or regenerate the patch.`;
  }
  if (checks.applied) {
    return `in use ${where} != ${patched}: not applied, but the installed code already matches it. Delete the patch.`;
  }
  return checks.applies
    ? `in use ${where} != ${patched}: not applied, but it still applies. Retarget or delete it.`
    : `in use ${where} != ${patched}: not applied, and it no longer applies. Rebase or delete it.`;
};

const neededBy: Record<string, () => string> = {
  "@alchemy.run/rivet": () =>
    "check by deleting the patch and running `bun run --cwd packages/coffee/server typecheck`: hosts/model/RivetDocker.ts passes a Docker.Swarm as the control plane's context",
  "@yielded/auth-persistence": () =>
    "check by deleting the patch and running `bun run --cwd packages/coffee/auth test`: passkey registration answers 503 while the bug remains",
};

for (const [spec, file] of Object.entries(manifest.patchedDependencies)) {
  const name = spec.slice(0, spec.lastIndexOf("@"));
  console.log(
    [
      spec,
      `  ${file}`,
      `  ${status(name, spec, file)}`,
      `  still needed? ${neededBy[name]?.() ?? "no check defined"}`,
      "",
    ].join("\n"),
  );
}
