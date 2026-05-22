# Backend Host

`@effect-coffee-shop/backend-host` provides runtime-agnostic Fetch host utilities.

It is not a Coffee business package. It owns the reusable host plumbing needed by Bun, Cloudflare,
AWS, and tests: mount dispatch, request logging, observability, JSON encoding helpers, and
request-scoped services.

## Directory Map

- [`src/fetch-host.ts`](./src/fetch-host.ts) routes Fetch requests to matching mounts and records
  request telemetry.
- [`src/mount.ts`](./src/mount.ts) defines mount contracts and request path helpers.
- [`src/request-services.ts`](./src/request-services.ts) creates the base request service context
  supplied to web handlers.
- [`src/logging.ts`](./src/logging.ts) writes structured request logs from generic log fields.
- [`src/observability.ts`](./src/observability.ts) wires console logging, runtime metrics, and
  optional OTLP export. Set `OTEL_SERVICE_NAME` to choose the exported service name.
- [`src/json.ts`](./src/json.ts) contains shared JSON encoding helpers.

## Boundary Rule

This package may know about generic Fetch requests and shared host concerns. It should not choose a
Coffee persistence layer, parse deployment-specific bindings, adapt MCP protocol details, or define
Coffee domain/application behavior. Runtime composition belongs in
[`apps/backend`](../../apps/backend).

## Commands

```bash
bun run --cwd packages/backend-host typecheck
bun run --cwd packages/backend-host lint
bun run --cwd packages/backend-host lint:custom
bun run --cwd packages/backend-host fmt:check
bun run --cwd packages/backend-host test
```
