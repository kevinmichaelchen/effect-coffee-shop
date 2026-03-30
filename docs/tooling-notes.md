# Tooling Notes

## Effect source of truth

For Effect v4 usage, the vendored `vendor/effect-smol` repo is the authority. If there is any doubt about APIs or conventions, update that submodule and prefer the current upstream code and docs over stale examples.

## MCP tool naming

The names passed to `Tool.make("...")` are protocol-level tool identifiers, not TypeScript method names.

Current `effect-smol` examples use a mix of styles:

- `DemoTool`
- `GetWeather`
- `get_weather`

That means snake_case is not required by Effect itself. In this repo, snake_case is used only for MCP-exposed tool names because it reads well as a wire format and is common for LLM-facing tool IDs. Internal TypeScript names should stay camelCase.

If we want, we can rename the public MCP tool IDs later. That would be a protocol change for clients, not an internal refactor.

## Vendored repos

- `vendor/effect-smol`
  - Runtime and API source of truth for Effect v4 usage in this repo.
- `vendor/lintcn`
  - A repo-owned type-aware rule workflow built around `tsgolint`.
- `vendor/alchemy-effect`
  - A likely future home for Cloudflare infrastructure provisioning, not application behavior.

## Oxc and TypeScript exploration

As of 2026-03-30, the cleanest path looks like this:

1. Keep `tsc --noEmit` for compile-time typechecking right now.
2. Evaluate `oxlint` first for fast non-type-aware linting.
3. Evaluate `oxfmt` with a trial diff before adopting it as the formatter.
4. Revisit Oxlint type-aware linting when we are ready for the TypeScript 7 toolchain shift.

### Oxlint

`oxlint` looks ready for early adoption as a fast base linter:

- Official docs position it as the primary linter or an incremental ESLint replacement.
- It supports native rules plus JS plugins, though JS plugin support is still marked alpha.
- It is a good fit for correctness-focused linting in CI before we add heavier type-aware rules.

### Oxfmt

`oxfmt` looks promising, but formatter swaps should be judged by diff quality, not by benchmarks alone.

Reasons it is worth evaluating:

- Official docs claim Prettier-compatible JavaScript and TypeScript output.
- It has built-in import sorting and related formatting features.
- It is designed for large repositories and CI throughput.

Recommended approach:

- Add it only after running a one-time diff against the current tree.
- Accept it if the formatting delta is small and stylistically acceptable.

### Type-aware linting

Oxlint's official type-aware mode is not just a flag flip on top of today's TypeScript compiler:

- It requires `oxlint-tsgolint`.
- The docs say it is powered by `tsgolint` plus `typescript-go`.
- The docs frame that runtime as TypeScript 7.

That matters because this repo currently uses `typescript@^5.9.3`. So the practical recommendation is:

- Do not replace `tsc --noEmit` with `oxlint --type-aware --type-check` yet.
- Revisit that once we intentionally move toward the TS6 to TS7 transition.

### TypeScript 6

TypeScript 6.0 beta was announced on 2026-02-11 as the bridge release before TypeScript 7's Go-based implementation.

For this repo, that suggests caution rather than urgency:

- We already depend on beta-stage Effect packages.
- We are still shaping the application architecture.
- Oxlint's type-aware story is converging around the TS7 era.

So the near-term recommendation is to stay on stable TypeScript 5.9.x until we have a concrete reason to move.

### lintcn

`lintcn` is interesting, but it solves a more specific problem than base linting:

- It focuses on repo-owned, type-aware TypeScript rules.
- Its workflow is useful once we know the architectural invariants we want to enforce.

That makes it a good second-phase tool, after the app patterns settle.

### alchemy-effect

`alchemy-effect` remains a good fit for a later infrastructure layer:

- The repo describes it as alpha.
- It is better aligned with deployment stacks than with our current in-memory application runtime.

That matches the intended plan to keep the onion core stable and swap only the external adapters when we move to Cloudflare.
