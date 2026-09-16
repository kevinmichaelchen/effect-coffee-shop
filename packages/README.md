# Packages

Library workspaces live under `packages/`. Coffee-specific libraries are nested
under `packages/coffee`, while shared HTTP routing utilities stay directly under
`packages`.

## Packages

- [`http-routing`](./http-routing): runtime-agnostic HTTP route dispatch,
  request logging, request-scoped services, and JSON encoding helpers.
- [`coffee/domain`](./coffee/domain): pure Coffee models with no workspace dependencies.
- [`coffee/application`](./coffee/application): Coffee use cases, ports, actors, and contracts.
- [`ui-kit`](./ui-kit): reusable UI primitives, fields, theme controls, and stories.
- [`coffee/testing`](./coffee/testing): shared repository contract tests for external adapters.
- [`tooling`](./tooling): shared Oxlint policy and Go custom lint rules.
- [`coffee/backend`](./coffee/backend): Coffee-specific backend composition that adapts
  presentation layers, auth context, and application layers to Web HTTP handlers.
- [`coffee/external/in-memory`](./coffee/external/in-memory): in-memory Coffee
  External Layer.
- [`coffee/external/sqlite`](./coffee/external/sqlite): SQLFU-backed SQLite/D1
  Coffee External Layer.
- [`coffee/external/drizzle-postgres`](./coffee/external/drizzle-postgres):
  Drizzle-backed Postgres Coffee External Layer.
- [`coffee/presentation/actions`](./coffee/presentation/actions):
  protocol-neutral Coffee action catalog used by Effect MCP tools.
- [`coffee/presentation/http`](./coffee/presentation/http): Effect HTTP API
  routes and web handler construction.
- [`coffee/presentation/mcp`](./coffee/presentation/mcp): MCP resources,
  prompts, Effect AI toolkit projection, tools, and stdio/HTTP MCP Layers.
- [`coffee/presentation/cli`](./coffee/presentation/cli): CLI command tree over
  `CoffeeOrderApp`.
- [`coffee/auth`](./coffee/auth): Better Auth passkey setup and actor resolution.
- [`coffee/runtime`](./coffee/runtime): runtime adapters for Bun, Cloudflare Workers, and AWS
  Lambda.

## Layer Placement

Domain models stay in [`coffee/domain`](./coffee/domain); application Layers stay in
[`coffee/application`](./coffee/application) when they
assemble pure application services from ports. External implementation Layers
stay with their owning External package, such as
[`coffee/external/sqlite`](./coffee/external/sqlite).

Presentation packages may export route, tool, server, or handler Layers. They do not choose the
concrete database or runtime implementation. [`coffee/backend`](./coffee/backend) composes Coffee
backend handlers, [`coffee/runtime`](./coffee/runtime) adapts those handlers to host runtimes, and
[`apps/backend`](../apps/backend) keeps only deployable entrypoint selection plus tests/scripts.
