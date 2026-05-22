# Packages

Library workspaces live under `packages/`. Coffee-specific libraries are nested
under `packages/coffee`, while shared host utilities stay directly under
`packages`.

## Packages

- [`backend-host`](./backend-host): runtime-agnostic fetch host primitives, mount
  dispatch, request logging, request-scoped services, and JSON encoding helpers.
- [`coffee/core`](./coffee/core): Coffee bounded-context Onion Core.
- [`coffee/external/in-memory`](./coffee/external/in-memory): in-memory Coffee
  External Layer.
- [`coffee/external/sqlite`](./coffee/external/sqlite): SQLFU-backed SQLite/D1
  Coffee External Layer.
- [`coffee/external/drizzle-postgres`](./coffee/external/drizzle-postgres):
  Drizzle-backed Postgres Coffee External Layer.
- [`coffee/actions`](./coffee/actions): shared coffee action contracts used by
  MCP tools, assistant tools, and Agent Auth capability execution.
- [`coffee/presentation/http`](./coffee/presentation/http): Effect HTTP API
  routes and web handler construction.
- [`coffee/presentation/mcp`](./coffee/presentation/mcp): MCP resources,
  prompts, tools, and stdio/HTTP MCP Layers.
- [`coffee/presentation/cli`](./coffee/presentation/cli): CLI command tree over
  `CoffeeOrderApp`.
- [`coffee/assistant`](./coffee/assistant): assistant request parsing,
  provider-neutral AI runtime, Cloudflare and Ollama adapters, streaming chunks,
  and assistant tool projection.
- [`coffee/auth`](./coffee/auth): Better Auth runtime setup and delegated Agent
  Auth capability execution.

## Layer Placement

Domain and application Layers stay in [`coffee/core`](./coffee/core) when they
assemble pure application services from ports. External implementation Layers
stay with their owning External package, such as
[`coffee/external/sqlite`](./coffee/external/sqlite).

Presentation packages may export route, tool, server, or handler Layers. They
do not choose the concrete database or runtime implementation.
[`apps/backend`](../apps/backend) is the shell that provides concrete Layers,
decodes deployment-specific runtime bindings, and composes Cloudflare or Bun
entrypoints.
