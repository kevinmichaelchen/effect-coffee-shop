# Packages

Library workspaces live under `packages/`. Coffee-specific libraries are nested
under `packages/coffee`, while shared host utilities stay directly under
`packages`.

## Packages

- `backend-host`: runtime-agnostic fetch host primitives, mount dispatch,
  request logging, request-scoped services, JSON formatting, and the MCP HTTP
  JSON-RPC id shim.
- `coffee/core`: Coffee bounded-context Onion Core.
- `coffee/external/in-memory`: in-memory Coffee External Layer.
- `coffee/external/sqlite`: SQLFU-backed SQLite/D1 Coffee External Layer.
- `coffee/external/drizzle-postgres`: Drizzle-backed Postgres Coffee External
  Layer.
- `coffee/actions`: shared coffee action contracts used by MCP tools,
  assistant tools, and Agent Auth capability execution.
- `coffee/presentation/http`: Effect HTTP API routes, web handler construction,
  and the local Bun HTTP server.
- `coffee/presentation/mcp`: MCP resources, prompts, tools, and stdio/HTTP MCP
  Layers.
- `coffee/presentation/cli`: CLI command tree over `CoffeeOrderApp`.
- `coffee/assistant`: assistant request parsing, Workers AI runtime, streaming
  chunks, and assistant tool projection.
- `coffee/auth`: Better Auth runtime setup and delegated Agent Auth capability
  execution.

## Layer Placement

Domain and application Layers stay in `packages/coffee/core` when they assemble
pure application services from ports. External implementation Layers stay with
their owning External package, such as `packages/coffee/external/sqlite`.

Presentation packages may export route, tool, server, or handler Layers. They
do not choose the concrete database or runtime implementation. `apps/backend`
is the shell that provides concrete Layers, decodes deployment-specific runtime
bindings, and composes Cloudflare or Bun entrypoints.
