# Backend HTTP Wiring

This directory holds Coffee-specific HTTP wiring shared by runtime adapters in
[`../../../runtime`](../../../runtime). It is where Coffee application layers, auth context, and protocol
handlers are adapted to standard Web [`Request` and `Response`][mdn-fetch] objects.

## Nomenclature

| Name             | Meaning                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `backend.ts`     | Builds the Coffee backend handler and request services used by runtime shells. |
| `api-route.ts`   | Adapts the Coffee HTTP API under `/api` into an `HttpRoute`.                   |
| `direct-auth.ts` | Applies direct HTTP auth rules before app routes handle a request.             |

`http` means product-level HTTP composition. Generic route dispatch, logging, request services, and
observability live in [`@effect-coffee-shop/http-routing`](../../../../http-routing), which is kept
Coffee-agnostic.

## Boundary Rule

Keep platform details out of this directory. Bun, Cloudflare, and AWS bindings belong in
[`../../../runtime`](../../../runtime); Coffee domain behavior belongs in
[`../../../core`](../../../core).

[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
