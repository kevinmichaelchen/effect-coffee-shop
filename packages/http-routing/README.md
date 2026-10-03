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
- [`src/logging.ts`](./src/logging.ts) defines the wide-event boundary and safe request fields.
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

## Request Logging

`createHttpRouter` uses [`effect-wide-event`](https://github.com/cevr/effect-wide-event) 0.6.0
to emit one `http_routing.request` event when a request effect finishes, including failures,
defects, and interruption. Auth, API, MCP, assets, and unmatched requests share this boundary.
Emission completes before the effect returns; streamed response bodies are not consumed or timed.
The inner Coffee Fetch handler keeps Effect's HTTP request logger disabled.
Lambda starts the same request scope before converting the incoming request or reading runtime
configuration. Its router reuses that scope, so setup failures emit once and routed requests do
not acquire a second event boundary.

`HttpObservabilityLive` supplies a single flat JSON console logger, runtime metrics, and optional
OTLP export. Bun and Cloudflare run the router through `runHttpEffect`; Lambda provides the same
layer within its invocation scope. Independent application/auth diagnostic logs can still appear.
When OTLP is enabled, its logger explicitly inherits the JSON logger; both sinks receive the event
without restoring Effect's default pretty console logger.
Lambda maps failed causes with Effect's native HTTP response mapper after emission, preserving
Alchemy's responses while avoiding its additional raw-cause fallback log.

Events include `service`, `method`, a locally generated `requestId`, `route_kind`, `durationMs`,
`timestamp`, `traceId`, `spanId`, and Effect exit `status` (`ok` or `error`). Returned responses also
include `http_status` and `outcome`: `ok` below 400, `warning` for 4xx, and `domain_error` for 5xx.
A returned HTTP error response is still a successful Effect exit. All boundary events use the
upstream default Info level. This replaces the former `.complete`/`.error` events and snake-case
method, path, duration, and request ID fields. Responses include the same generated ID in
`x-request-id`, including Lambda responses for failures before routing. Adding this header copies
response headers without reading or buffering the body, and supports immutable asset/redirect
responses.

URLs (including path segments), request/response headers and bodies, environment bindings, and raw
error values are excluded. Failure details use fixed `Failure`, `Defect`, or `Interrupted` labels
and messages. Request spans also omit raw paths. Use `route_kind` for the selected route branch
and trace IDs for correlation; incoming transport IDs are not copied into logs.

Route `logFields` can add trusted, non-sensitive scalar metadata to the event. Code executing in
the router's Effect context can also use `WideEvent.setOptional` to enrich it. The separate inner
Fetch runtime does not inherit this accumulator. Keep credentials and personal data out of both
extensions; do not add another wide-event boundary to an inner HTTP handler.

## Commands

```bash
bun run --cwd packages/http-routing typecheck
bun run --cwd packages/http-routing lint
bun run --cwd packages/http-routing lint:custom
bun run --cwd packages/http-routing fmt:check
bun run --cwd packages/http-routing test
```

[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
