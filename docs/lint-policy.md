# Effect lint policy

Effect workspaces and Alchemy infrastructure extend the recommended preset from
`@mpsuesser/oxlint-plugin-effect`, pinned to **0.5.0**. That preset contains all 73
plugin rules. TypeScript configuration files import the preset directly, so new
rules in future dependency upgrades are included automatically. Existing package
architecture restrictions remain in each package's `.oxlintrc.json`.

Run `bun run lint` for workspace and infrastructure lint, or `bun run ci:static`
for the same checks with formatting and TypeScript/Effect diagnostics. Turbo
tracks the shared configuration and caches infrastructure lint as its own task.
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
without a `Schema` suffix. Optional domain values and provider selection use
`Option`; schema codecs retain external storage and transport encodings. Pure
Effect tests use `@effect/vitest`; effectful test traversals specify concurrency.
Assistant stream timestamps use the captured Effect clock, random stream IDs use
Effect random, and repository sorting uses Effect array/order helpers.
