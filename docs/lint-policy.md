# Lint

Both Oxlint profiles in `packages/tooling/oxlint.profiles.ts` run type-aware under
`effect-tsgo --tsrs-lint oxlint` with every Effect language-service rule; a workspace points at a
profile and never carries its own Oxlint config.

Checks live in prek hooks, the slower ones rarer: commit runs format, combined lint/typechecking and Fallow,
push runs the same set over the pushed commits (`check:affected`), and a pushed `v*` tag runs
`check:release`, which adds the emulator and Rivet stack tests plus Fallow's typed health pass.
There is no CI.

| Rule prefix   | Source                                                                                             | Arrives as                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `effecttsgo/` | [Effect-TS/tsgo](https://github.com/Effect-TS/tsgo) (Effect team)                                  | npm `@effect/tsgo`                                                                                     |
| `effect/`     | [mpsuesser/oxlint-plugin-effect](https://github.com/mpsuesser/oxlint-plugin-effect) (Marc Suesser) | npm; bundles a snapshot of [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) (Dillon Mulroy) |
| `anti-slop/`  | [k-mistele/anti-slop](https://github.com/k-mistele/anti-slop) (Kyle Mistele's fork of Dillon's)    | verbatim copy in `packages/tooling/vendor/anti-slop/`                                                  |
| `foldkit/`    | [foldkit/foldkit](https://github.com/foldkit/foldkit) (Devin Jameson), `ui` only                   | npm `@foldkit/oxlint-plugin`                                                                           |
| (none yet)    | [typeonce-dev/ai-automation](https://github.com/typeonce-dev/ai-automation) (Sandro Maglione)      | reviewed only; several house and `effect/` rules share his ideas                                       |
| `house/`      | us                                                                                                 | `packages/tooling/oxlint-plugin-house.ts`                                                              |

> [!NOTE]
> `packages/tooling/rule-sources.json` records every upstream rule from Dillon, Kyle and Sandro with
> our decision: adopted, covered by one of our rules, candidate, or declined with a reason.
> `bun run --cwd packages/tooling rules:check` reports upstream changes since each review, new or
> removed upstream rules, edits to vendored copies, decisions that point at a rule no profile
> enables, and newer rule packages.

<details>
<summary>Profiles, the house plugin, and Fallow</summary>

- `backend` adds every rule of `@mpsuesser/oxlint-plugin-effect`; `ui` takes only its
  type-assertion rules (`no-chained-type-assertions`, `no-known-value-widening`,
  `no-widen-then-assert`, `require-safety-comment-for-type-assertion`, `no-reflect-*`) plus
  `no-console` outside `scripts/`. The profile comment says which rules stay backend-only and why.
- Both profiles enable the `correctness`, `suspicious` and `perf` categories and the
  unsafe-TypeScript rules (`no-explicit-any`, `no-unsafe-*`, `no-unsafe-type-assertion`,
  `strict-boolean-expressions`, ...).
- Lint is type-aware and type-checks; since tsrs 0.23 that check covers the whole program of each
  tsconfig Oxlint's files map to, so lint can fail on a type error in a file it does not lint.
  The `lint` task is the single compiler and lint gate for builds and tests.
- Lint runs through the official [`@effect/tsgo`](https://github.com/Effect-TS/tsgo), which loads
  Oxlint with an Effect-patched native binding on the tsrs linter instead of `tsgolint`. Oxlint and
  tsrs are pinned to versions in its "Supported Package Versions" table.
- No rule limits file or function size. Deep modules are preferred; Fallow health reports
  complexity.
- Both profiles enable three rules from Kyle's anti-slop fork (`max-ternary-depth`,
  `no-reprovide-ambient-service`, `prefer-tagged-error-handling`). Vendored files stay
  byte-identical to upstream (lint, oxfmt and Fallow ignore `vendor/`) so drift is a plain diff.
- To adopt a rule: copy it and its test from the source's reviewed commit into `vendor/<source>/`,
  list the files under `vendored`, import the test from the plugin's `*.test.ts`, enable it, and
  set its status to `adopted`. To resolve a conflict between two sources (both have
  `prefer-effect-match`), pick one copy and mark the other `covered` by it. After reviewing an
  upstream change, move `reviewed` to the new commit.
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
