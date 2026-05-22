# Backend Host

`@effect-coffee-shop/backend-host` provides runtime-agnostic Fetch host utilities.

It is not a Coffee business package. It owns the reusable host plumbing needed by Bun, Cloudflare,
AWS, and tests: mount dispatch, request logging, observability, JSON helpers, request-scoped
services, and the MCP HTTP JSON-RPC id compatibility shim.

## Directory Map

- `src/fetch-host.ts` routes Fetch requests to matching mounts and records request telemetry.
- `src/mount.ts` defines mount contracts and request path helpers.
- `src/request-services.ts` creates the base request service context supplied to web handlers.
- `src/logging.ts` writes structured request and actor logs.
- `src/observability.ts` wires console logging, runtime metrics, and optional OTLP export.
- `src/json.ts` contains shared JSON formatting helpers.
- `src/http-jsonrpc-ids.ts` adapts MCP HTTP JSON-RPC ids across host boundaries.

## Boundary Rule

This package may know about generic Fetch requests and shared host concerns. It should not choose a
Coffee persistence layer, parse deployment-specific bindings, or define Coffee domain/application
behavior.

## Commands

```bash
bun run --cwd packages/backend-host typecheck
bun run --cwd packages/backend-host lint
bun run --cwd packages/backend-host lint:custom
bun run --cwd packages/backend-host fmt:check
bun run --cwd packages/backend-host test
```
