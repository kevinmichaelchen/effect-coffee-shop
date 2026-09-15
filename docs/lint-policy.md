# Effect lint policy

Effect workspaces and Alchemy infrastructure extend the recommended preset from
`@mpsuesser/oxlint-plugin-effect`, pinned to **0.5.0**. That preset contains all 73
plugin rules. TypeScript configuration files import the preset directly, so new
rules in future dependency upgrades are included automatically. Existing package
architecture restrictions remain in each package's `.oxlintrc.json`.

Run `bun run lint` for workspace and infrastructure lint, or `bun run ci:static`
for the same checks with formatting and TypeScript/Effect diagnostics. Turbo
tracks the shared configuration; the infrastructure workspaces lint like any
other package.
The React UI retains its separate policy; it does not inherit backend-only rules.

## Deliberate exceptions

This is not an unconditional pass of every upstream rule:

- `effect/effect-promise-vs-trypromise` is disabled in the shared preset wrappers.
  `AGENTS.md` explicitly prefers `Effect.promise` for defects and reserves
  `Effect.tryPromise` for translating failures into typed domain errors.
- Generated SQL files under `.generated` are excluded from authored-code lint.
  They remain part of type checking and repository contract tests.
- Individual source lines document required interoperability: native HTTP/SDK
  optional fields, SQL NULL encoding, arbitrary input at schema decoders,
  serialization, cryptographic APIs, native integration probes, and runtime or
  test-harness calls that execute Effects. Application workflows compose Effects
  and use typed domain values after those boundaries.
- Plugin false positives have local comments: schema decoder functions have no
  `.Type` member, `Context.Service.Shape` belongs to Effect, and constructing a
  fixed test date does not read the wall clock. Native `ReadonlySet` ports cannot
  accept Effect `HashSet` without changing their contract.

Exceptions are attached to the affected line, not a blanket migration baseline.
Unused disable directives fail lint. Keep each exception's explanation accurate;
remove it when its boundary disappears or the upstream rule is corrected.

## Conventions adopted

Schemas and their exported types share a domain name (`CoffeeOrder`, `CartItem`),
without a `Schema` suffix. Optional domain values use
`Option`; schema codecs retain external storage and transport encodings. Pure
Effect tests use `@effect/vitest`; effectful test traversals specify concurrency.
Repository sorting uses Effect array/order helpers.

## Local enforcement

Prek owns the quality gates. `bun run hooks:run:pre-commit` checks all configured
workspace and root formatting, lint, and compiler projects. `bun run
hooks:run:pre-push` runs affected workspace checks, tests and builds, including
the infrastructure workspaces' integration tests; root tooling checks; custom
lint; full Fallow; and both Knip modes.
`bun run check` runs the complete local suite without affected-file filtering.
These commands do not depend on GitHub Actions. The prepare script installs the
hooks in ordinary checkouts and linked worktrees.

The Alchemy stacks (`infra/alchemy`) and the Turbo cache deployment
(`infra/turbo-cache`) are Bun workspaces, so their typecheck, lint, format and
test tasks are ordinary per-package Turbo tasks with gitignore-aware default
inputs. Cross-workspace coverage comes from the package graph rather than
input globs: the Alchemy workspace depends on the backend, the Cloudflare
runtime and the UI it bundles, and every `test` task depends on `typecheck`,
which depends on `^typecheck`, so an edit in any bundled package changes the
smoke test's hash. The UI dependency exists only for that edge; Fallow and
Knip are told to ignore it because the stack builds the UI by path instead of
importing it. The Alchemy stack anchors its cross-workspace paths at the
repository root so it deploys from the root scripts and tests from the
workspace directory alike. `bun run cf:test` and `bun run cache:test` are
filtered aliases for the two workspace test tasks.

The remaining root Turbo tasks cover only root-level tooling files: the
tooling compiler project, the shared Oxlint policy, and root configuration
formatting. Their inputs are a few explicit files, so they need no gitignore
reconstruction. Tool configuration files use `tsconfig.tools.json`: the Effect
lint plugin has its own Effect dependency, so only this tooling compiler
project permits that duplicate package. Application compiler projects keep
their original strict duplication check. Generated SQL convenience files are
explicitly included in the SQLite compiler project even when nothing imports
them.

## React and test safeguards

The UI runs native Oxlint checks plus the React Hooks `rules-of-hooks` and React
Refresh `only-export-components` JavaScript-plugin rules. The obsolete ESLint
configuration was removed: its TypeScript-ESLint parser does not support the
pinned TypeScript 7 compiler. React Refresh permits constant exports, matching the
Vite preset. Unused disable directives fail UI lint as they do backend lint.

Vitest's focused-test rule is enabled. Test files and helpers additionally forbid
`.only` property access, covering wrappers such as `it.effect.only` that the
native Vitest call recognizer misses. The standalone-expect rule recognizes
Effect and Alchemy test blocks. Assertion-discovery heuristics are disabled for backend tests:
Effect smoke tests can assert success by executing without a failed effect.
The shared repository-contract factory also permits parameterized test titles.

## Fallow and Knip

Fallow requires every reachable file to belong to an architecture zone; unused
files fail its dead-code check.
The infrastructure workspaces and the Turbo cache implementation have explicit
zones; tool configuration and Storybook support form a tooling zone. Production/application
zones cannot import tooling. Semantic queries are configured for all compiler
projects and require complete evidence. The push gate runs the full scan;
`fallow:audit` remains available for a quick, syntactic changed-file review.
The health analysis runs syntactically: with type-aware analysis enabled it
otherwise issues an advisory type-coupling query that scans every project for
about fifty seconds and reports partial evidence, which the complete gate
rejects. Complexity thresholds need no semantic evidence.

Public signatures expose their named types. A small number of transitive type
aliases carry `@public` because Knip does not see an external reference through
the enclosing public type; Fallow checks the signature relationship. This tag is
for a reviewed public contract, not a general unused-code suppression.

`bun run knip` checks the development graph, including namespace exports and
namespace types. `bun run knip:production` additionally uses strict production
mode, requiring direct runtime dependency declarations in the owning workspace.
Deployment entrypoints are explicit in each infrastructure workspace, and the
backend exports its Lambda and Worker entrypoints so the Alchemy workspace can
declare that dependency. Package export maps exclude test files;
the core package still exports its repository-test harness and therefore declares
`@effect/vitest` as a dependency of that public API.

Knip configuration comments explain the limited exceptions: the embedded Effect
language-service settings key, Bun-wrapped Oxlint binaries, ambient Cloudflare
types, and externally installed Portless. Generated SQL stays in Knip's import
graph, but unused generator-owned convenience files/exports are not cleanup
candidates. Source-owned files and exports remain checked. Both Knip modes and
full Fallow must pass before a push, and Knip treats configuration hints as
errors. Fallow explicitly recognizes the two React plugin dependencies because
its Oxlint config discovery misses aliased JavaScript plugins; the UI lint
command executes both plugins. Workspaces whose `oxlint.config.ts` imports the
Effect lint plugin declare it themselves through the catalog, so no Fallow
exemption is needed for it. The Fallow policy detector is explicitly off because
no rule packs are configured.

prek, oxlint, oxfmt and oxlint-tsgolint are excluded from the 72-hour release-age
policy in `bunfig.toml`, including every platform binding package, so they can be
adopted as soon as they publish.
