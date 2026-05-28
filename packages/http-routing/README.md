# HTTP Routing

`@effect-coffee-shop/http-routing` provides runtime-agnostic HTTP routing utilities.

It is not a Coffee business package. It owns the reusable HTTP plumbing needed by Bun, Cloudflare,
AWS, and tests: route dispatch, request logging, observability, JSON encoding helpers, and
request-scoped services over standard Web [`Request` and `Response`][mdn-fetch] objects.

## Directory Map

- [`src/router.ts`](./src/router.ts) routes standard Web `Request`s to matching routes and records
  request telemetry.
- [`src/route.ts`](./src/route.ts) defines route contracts and request path helpers.
- [`src/request-services.ts`](./src/request-services.ts) creates the base request service context
  supplied to web handlers.
- [`src/logging.ts`](./src/logging.ts) writes structured request logs from generic log fields.
- [`src/observability.ts`](./src/observability.ts) wires console logging, runtime metrics, and
  optional OTLP export. Set `OTEL_SERVICE_NAME` to choose the exported service name.
- [`src/json.ts`](./src/json.ts) contains shared JSON encoding helpers.

## Boundary Rule

This package may know about generic HTTP requests and shared routing concerns. It should not choose
a Coffee persistence layer, parse deployment-specific bindings, adapt MCP protocol details, or
define Coffee domain/application behavior. Runtime composition belongs in
[`apps/backend`](../../apps/backend).

## Nomenclature

`http-routing` is deliberately narrower than "backend" and broader than any one runtime. It routes
Web HTTP requests, while platform adapters decide how those requests arrive. The exported
`HttpRoute` contract is an Effect-based route branch; `createHttpRouter` turns a route list into the
single request handler used by Bun, Cloudflare, AWS, and tests.

## Commands

```bash
bun run --cwd packages/http-routing typecheck
bun run --cwd packages/http-routing lint
bun run --cwd packages/http-routing lint:custom
bun run --cwd packages/http-routing fmt:check
bun run --cwd packages/http-routing test
```

[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
