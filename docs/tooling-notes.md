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

## Adopted toolchain

As of 2026-03-30, this repo is pinned to:

- `@typescript/native-preview@7.0.0-dev.20260330.1`
- `oxlint@1.57.0`
- `oxlint-tsgolint@0.18.1`
- `oxfmt@0.42.0`

### Typechecking

Primary typechecking now runs through `tsgo`:

- `bun run typecheck` -> `tsgo --noEmit`

The repo no longer carries a separate `typescript` package. The compiler path is intentionally the bleeding-edge native preview only.

### Oxlint

Root lint configuration lives in `.oxlintrc.json`.

The adopted settings are:

- `options.typeAware: true`
- `options.typeCheck: true`
- `options.maxWarnings: 0`
- `ignorePatterns: ["vendor/**"]`

`bun run lint` uses `oxlint --disable-nested-config .` so only the root repo config applies, even though vendored dependencies contain their own lint configs.

### Oxfmt

`oxfmt` is now the formatter of record for this repo.

The relevant root files are:

- `.oxfmtrc.json`
- `.prettierignore`

`.prettierignore` excludes `vendor/` so formatting runs stay focused on the application code instead of vendored upstream repositories.

### lintcn

`lintcn` is vendored for future repo-owned type-aware rules. It is not yet wired into the day-to-day scripts because the app-specific invariants worth encoding there are still emerging.

### alchemy-effect

`alchemy-effect` is still best treated as a later infrastructure concern, not part of the local Bun runtime path for this in-memory scaffold.
