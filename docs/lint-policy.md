# Lint

- Oxlint policy lives in `packages/tooling/oxlint.profiles.ts`: a `backend` profile (adds the `@mpsuesser/oxlint-plugin-effect` house style) and a `ui` profile. Every workspace's `lint` script points at one of them; there are no per-workspace Oxlint configs.
- Lint runs through `effect-tsgo oxlint` from the official [`@effect/tsgo`](https://github.com/Effect-TS/tsgo), which loads Oxlint with an Effect-patched native binding and `tsgolint`, adding the Effect language-service rules (`effecttsgo/*`, the strict preset plus selected opt-ins). Oxlint and `oxlint-tsgolint` are pinned to the newest versions in its "Supported Package Versions" table.
- Both profiles enable the `correctness`, `suspicious` and `perf` categories and the unsafe-TypeScript rules (`no-explicit-any`, `no-unsafe-*`, `no-unsafe-type-assertion`, `strict-boolean-expressions`, ...). Lint is type-aware and type-checks; typecheck is `tsrs --noEmit`.
- No rule limits file or function size. Deep modules are preferred; Fallow health reports complexity.
- Custom Go rules live in `packages/tooling/.lintcn` (backend) and `apps/ui/.lintcn` (UI). They need Go 1.26 (`GOTOOLCHAIN=auto`).
- Fallow owns architecture: zones and allowed imports in `.fallowrc.jsonc`, runtime import and side-effect bans in `.fallow/rules/runtime-boundaries.jsonc`. `bun run fallow` also gates unused code (default and production passes), duplication and health.
- `bun run check` runs everything; prek runs it on commit and push.
- Disable a rule on the affected line only, with a reason. Unused disables fail lint.
