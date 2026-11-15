# Lint

Both Oxlint profiles in `packages/tooling/oxlint.profiles.ts` run type-aware under
`effect-tsgo --tsrs-lint oxlint` with every Effect language-service rule; a workspace points at a
profile and never carries its own Oxlint config.

Checks live in prek hooks, the slower ones rarer: commit runs format, lint, typecheck and Fallow,
push runs the same set over the pushed commits (`check:affected`), and a pushed `v*` tag runs
`check:release`, which adds the emulator and Rivet stack tests plus Fallow's typed health pass.
There is no CI.

<details>
<summary>Profiles, the house plugin, and Fallow</summary>

- `backend` adds every rule of `@mpsuesser/oxlint-plugin-effect` (which vendors
  [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop)'s generic rules); `ui` takes only its
  type-assertion rules (`no-chained-type-assertions`, `no-known-value-widening`,
  `no-widen-then-assert`, `require-safety-comment-for-type-assertion`, `no-reflect-*`) plus
  `no-console` outside `scripts/`. The profile comment says which rules stay backend-only and why.
- Both profiles enable the `correctness`, `suspicious` and `perf` categories and the
  unsafe-TypeScript rules (`no-explicit-any`, `no-unsafe-*`, `no-unsafe-type-assertion`,
  `strict-boolean-expressions`, ...).
- Lint is type-aware and type-checks; since tsrs 0.23 that check covers the whole program of each
  tsconfig Oxlint's files map to, so lint can fail on a type error in a file it does not lint.
  Typecheck is `tsrs --noEmit`.
- Lint runs through the official [`@effect/tsgo`](https://github.com/Effect-TS/tsgo), which loads
  Oxlint with an Effect-patched native binding on the tsrs linter instead of `tsgolint`. Oxlint and
  tsrs are pinned to versions in its "Supported Package Versions" table.
- No rule limits file or function size. Deep modules are preferred; Fallow health reports
  complexity.
- Repo-specific rules live in `packages/tooling/oxlint-plugin-house.ts`, a local Oxlint JS plugin
  that both profiles load as `house`. It enforces AGENTS.md bans no published plugin covers
  (`house/no-in-operator`, `house/no-instanceof`, `house/no-classic-for-loop`) in every workspace,
  and `backend` adds layering and Effect pipeline-shape rules. The rules are syntactic and tested
  with Oxlint's `RuleTester` in `oxlint-plugin-house.test.ts`: add a rule there and enable it in the
  profile.
- Fallow owns architecture: zones and allowed imports in `.fallowrc.jsonc`, side-effect bans in the
  rule pack `packages/tooling/fallow/runtime-boundaries.jsonc`. Bans on outside modules in the
  portable core (`node:*`, `bun`, platform adapters) are `no-restricted-imports` overrides in the
  backend profile, where wildcards work. Keep rule packs out of `.fallow/`: Fallow writes a
  `.gitignore` there that ignores everything, so a pack placed in it never reaches the repository.
- `bun run fallow` gates unused code in two passes (the combined pass covers the default mode,
  duplication and health; a second `dead-code --production` pass adds type-only dependencies and
  shipping dead code). Its committed health baseline lives in `fallow-baselines/`, never in the
  `.fallow/` cache.
- Health runs with `--no-type-aware` even though `typeAware.enabled` is on: on Fallow 3.43.1 the
  syntactic pass scores the same as the type-aware one in a fraction of the time, and the dead-code
  pass keeps the type-aware evidence, because that is where it changes a finding.
- Disable a rule on the affected line only, with a reason. Unused disables fail lint.

</details>
