# HTTP Routing

`@effect-coffee-shop/http-routing` provides runtime-agnostic HTTP plumbing.

It is not a Coffee business package. The [Coffee Worker](../coffee/server) uses its wide-event
request logging (`withHttpWideEvent` and `annotateHttpStatus` from `src/logging.ts`). The package
also keeps generic route dispatch, request-scoped services, observability, and JSON helpers over
standard Web [`Request` and `Response`][mdn-fetch] objects; the Worker routes with Effect's
`HttpRouter` instead and does not mount `createHttpRouter`.

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
[`coffee-server`](../coffee/server).

## Request Logging

`withHttpWideEvent` uses [`effect-wide-event`](https://github.com/cevr/effect-wide-event) 0.6.0
to emit one `http_routing.request` event when a request effect finishes, including failures,
defects, and interruption. Nested calls reuse the outer event instead of opening a second one.
`annotateHttpStatus` records the selected `route_kind` and the response status. In the Coffee
Worker, domain Api, auth, REST, MCP, and unmatched requests share this boundary; the Worker logs
with `WideEventLogger.Json` and maps failed causes with Effect's native HTTP response mapper after
the event is recorded, so callers get a safe response instead of a raw error. Emission completes
before the effect returns; streamed response bodies are not consumed or timed.

`createHttpRouter` and `runHttpRequest` apply the same boundary for Web `Request` handlers, and
`HttpObservabilityLive` supplies a flat JSON console logger, runtime metrics, and optional OTLP
export (`OTEL_SERVICE_NAME` chooses the exported service name).

Events include `service`, `method`, a locally generated `requestId`, `route_kind`, `durationMs`,
`timestamp`, `traceId`, `spanId`, and Effect exit `status` (`ok` or `error`). Effects that return a
response also record `http_status` and `outcome`: `ok` below 400, `warning` for 4xx, and `domain_error` for 5xx.
A returned HTTP error response is still a successful Effect exit. All boundary events use the
upstream default Info level. This replaces the former `.complete`/`.error` events and snake-case
method, path, duration, and request ID fields. `withResponseRequestId` can add the same generated
ID as `x-request-id`; it copies response headers without reading or buffering the body.

URLs (including path segments), request/response headers and bodies, environment bindings, and raw
error values are excluded. Failure details use fixed `Failure`, `Defect`, or `Interrupted` labels
and messages. Request spans also omit raw paths. Use `route_kind` for the selected route branch
and trace IDs for correlation; incoming transport IDs are not copied into logs.

`createHttpRouter` route `logFields` (and `annotateHttpStatus` `extraFields`) can add trusted
scalar metadata to the event, for example `actor_kind` and the pseudonymous application user ID
`actor_user_id`. These IDs support correlation and are not anonymous data: restrict log access
and retention accordingly.

Code executing inside the boundary's Effect context can also use `WideEvent.setOptional` to enrich
it. Keep credentials and directly identifying data (such as names, email addresses, and phone numbers) out of both extensions; do not
add another wide-event boundary to an inner HTTP handler.

## Commands

```bash
bun run --cwd packages/http-routing typecheck
bun run --cwd packages/http-routing lint
bun run --cwd packages/http-routing lint:custom
bun run --cwd packages/http-routing fmt:check
bun run --cwd packages/http-routing test
```

[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
