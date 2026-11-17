# HTTP Routing

`@effect-coffee-shop/http-routing` is runtime-agnostic wide-event logging for HTTP requests. Routing
itself belongs to Effect's `HttpRouter`, which the Coffee Worker uses directly; this package only
knows generic requests.

| File             | What                                                         |
| ---------------- | ------------------------------------------------------------ |
| `src/logging.ts` | The wide-event boundary, safe request fields, `x-request-id` |
| `src/index.ts`   | Re-exports                                                   |

<details>
<summary>What a request event records</summary>

`withHttpWideEvent` uses [`effect-wide-event`](https://github.com/cevr/effect-wide-event) 0.6.0 to
emit one `http_routing.request` event when a request effect finishes, including failures, defects,
and interruption. Nested calls reuse the outer event instead of opening a second one.
`annotateHttpStatus` records the selected `route_kind` and the response status. In the Coffee Worker,
domain Api, auth, REST, MCP, and unmatched requests share this boundary; the Worker logs with
`WideEventLogger.Json` and maps failed causes with Effect's native HTTP response mapper after the
event is recorded, so callers get a safe response instead of a raw error. Emission completes before
the effect returns; streamed response bodies are not consumed or timed.

Events include `service`, `method`, a locally generated `requestId`, `route_kind`, `durationMs`,
`timestamp`, `traceId`, `spanId`, and Effect exit `status` (`ok` or `error`). Effects that return a
response also record `http_status` and `outcome`: `ok` below 400, `warning` for 4xx, and
`domain_error` for 5xx. A returned HTTP error response is still a successful Effect exit. All boundary
events use the upstream default Info level. `withResponseRequestId` can add the same generated ID as
`x-request-id`; it copies response headers without reading or buffering the body.

</details>

<details>
<summary>What stays out of the event, and the boundary rule</summary>

URLs (including path segments), request/response headers and bodies, environment bindings, and raw
error values are excluded. Failure details use fixed `Failure`, `Defect`, or `Interrupted` labels and
messages. Request spans also omit raw paths. Use `route_kind` for the selected route branch and trace
IDs for correlation; incoming transport IDs are not copied into logs.

`annotateHttpStatus` accepts trusted scalar `extraFields` for the event, for example `actor_kind` and
the pseudonymous application user ID `actor_user_id`. These IDs support correlation and are not
anonymous data: restrict log access and retention accordingly. Code inside the boundary's Effect
context can also use `WideEvent.setOptional` to enrich it. Keep credentials and directly identifying
data (such as names, email addresses, and phone numbers) out of both, and do not add another
wide-event boundary inside an inner HTTP handler.

This package may know about generic HTTP requests. It must not choose a Coffee persistence layer,
parse deployment-specific bindings, adapt MCP protocol details, or define Coffee domain behavior;
runtime composition belongs in [`coffee-server`](../coffee/server).

```bash
bun run --cwd packages/http-routing lint
bun run --cwd packages/http-routing fmt:check
```

</details>
