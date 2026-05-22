# Coffee HTTP

`@effect-coffee-shop/coffee-http` adapts the Coffee application service to an Effect HTTP API.

It defines HTTP groups, endpoint schemas, handler layers, a Web Fetch handler adapter, and a local
Fetch handler adapter. The package owns the HTTP shape, but not database selection, deployment
bindings, assistant serving, or core business behavior.

## Directory Map

- [`src/api.ts`](./src/api.ts) defines health, session, menu, and order HTTP API groups and
  handlers.
- [`src/mcp-jsonrpc-ids.ts`](./src/mcp-jsonrpc-ids.ts) preserves MCP JSON-RPC ids when MCP HTTP
  routes are served through the shared web handler.
- [`src/web-handler.ts`](./src/web-handler.ts) turns API layers into a Fetch-compatible handler.
- [`src/test-support.ts`](./src/test-support.ts) contains HTTP test helpers.

## Boundary Rule

HTTP paths, HTTP payload decoding, response schemas, and HTTP handler composition belong here.
Request actor resolution, assistant routes, concrete persistence, and Bun server wiring are provided
by runtime shells such as [`apps/backend`](../../../../apps/backend). Business behavior stays in
[`coffee-core`](../../core).

## Commands

```bash
bun run --cwd apps/backend http
bun run --cwd packages/coffee/presentation/http typecheck
bun run --cwd packages/coffee/presentation/http lint
bun run --cwd packages/coffee/presentation/http lint:custom
bun run --cwd packages/coffee/presentation/http fmt:check
bun run --cwd packages/coffee/presentation/http test
```
