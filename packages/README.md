# Presentation Packages

The backend presentation layer is split into workspace packages so protocol
surfaces can be composed independently from deployment shells.

## Packages

- `backend-host`: runtime-agnostic fetch host primitives, mount dispatch,
  request logging, request-scoped services, JSON formatting, and the MCP HTTP
  JSON-RPC id shim.
- `coffee-actions`: shared coffee action contracts used by MCP tools,
  assistant tools, and Agent Auth capability execution.
- `coffee-http`: Effect HTTP API routes, web handler construction, and the
  local Bun HTTP server.
- `coffee-mcp`: MCP resources, prompts, tools, and stdio/HTTP MCP Layers.
- `coffee-cli`: CLI command tree over `CoffeeOrderApp`.
- `coffee-assistant`: assistant request parsing, Workers AI runtime, streaming
  chunks, and assistant tool projection.
- `coffee-auth`: Better Auth runtime setup and delegated Agent Auth capability
  execution.

## Layer Placement

Domain and application Layers stay in `packages/domains/coffee/core` when they assemble
pure application services from ports. External implementation Layers stay with
their owning External package, such as `packages/domains/coffee/external-sqlite`.

Presentation packages may export route, tool, server, or handler Layers. They
do not choose the concrete database or runtime implementation. `apps/backend`
is the shell that provides concrete Layers, decodes deployment-specific runtime
bindings, and composes Cloudflare or Bun entrypoints.
